import { useEffect, useMemo, useRef, useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { HOLES } from '../lib/holes.js'
import { prepare } from '../lib/imagePrep.js'
import { recognizeWords } from '../lib/ocr.js'
import { buildTable, nameCandidates, normalizeBlock, readHeader } from '../lib/cardVision.js'

const NINE = 9
const sum = (a) => a.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0)
const filled = (a) => a.filter((v) => Number.isFinite(v)).length

/** 전반/후반 블록을 18홀 한 줄로 합친다 */
function mergeNines(nines) {
  const pad = () => Array(NINE).fill(null)
  const front = nines[0] ?? { pars: pad(), rows: [] }
  const back = nines[1] ?? { pars: pad(), rows: [] }

  const pars = [...front.pars, ...back.pars]

  const count = Math.max(front.rows.length, back.rows.length)
  const rows = []
  for (let i = 0; i < count; i++) {
    const f = front.rows[i]
    const b = back.rows[i]
    rows.push({
      label: f?.label || b?.label || `${i + 1}번째 줄`,
      overs: [...(f?.overs ?? pad()), ...(b?.overs ?? pad())],
      nineTotals: [f?.total ?? null, b?.total ?? null],
    })
  }
  return { pars, rows }
}

/** 각 9홀에 대해 파 합계 + 오버 합계 == T 인지 본다 */
function checkRow(pars, overs, nineTotals) {
  const out = []
  for (const [n, from] of [[0, 0], [1, NINE]]) {
    const claimed = nineTotals[n]
    const p = pars.slice(from, from + NINE)
    const o = overs.slice(from, from + NINE)
    if (filled(p) < NINE || filled(o) < NINE || !Number.isFinite(claimed)) {
      out.push({ ok: null, computed: null, claimed })
    } else {
      const computed = sum(p) + sum(o)
      out.push({ ok: computed === claimed, computed, claimed })
    }
  }
  return out
}

/**
 * 스코어카드 사진에서 홀별 기록 초안을 만든다.
 * 어떤 경우에도 바로 저장하지 않는다 — 사용자가 표에서 확인하고 고친 뒤 저장한다.
 */
export default function ScorecardImport({ onDraft, savedTick = 0 }) {
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState({ value: 0, note: '' })
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { meta, pars, rows }
  const [assign, setAssign] = useState({}) // rowIndex -> member | ''
  const [rawText, setRawText] = useState('')
  const [showText, setShowText] = useState(false)
  const [queue, setQueue] = useState([])       // 아직 읽지 않은 카드들
  const [queued, setQueued] = useState(null)   // { index, total }
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  /** 여러 장을 받으면 한 장씩 순서대로 읽는다. 한 장 = 한 라운드. */
  const accept = (files) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    setQueue(images.slice(1))
    setQueued({ index: 1, total: images.length })
    run(images[0])
  }

  // 부모가 한 라운드를 저장하면 다음 카드로 넘어간다
  useEffect(() => {
    if (savedTick === 0 || queue.length === 0) return
    const [next, ...rest] = queue
    setQueue(rest)
    setQueued((q) => ({ index: (q?.index ?? 0) + 1, total: q?.total ?? 1 }))
    run(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTick])

  const run = async (file) => {
    if (!file) return
    setPhase('working')
    setError('')
    setResult(null)
    setRawText('')
    setProgress({ value: 0.02, note: '사진 준비 중' })

    try {
      const report = (value, note) => setProgress({ value, note })

      const { canvas } = await prepare(file, { scale: 2 })

      report(0.55, '글자 읽는 중')
      const textPass = await recognizeWords(canvas, 'text', report)

      report(0.8, '숫자 읽는 중')
      const digitPass = await recognizeWords(canvas, 'digits', report)

      setRawText(`[글자]\n${textPass.text}\n\n[숫자만]\n${digitPass.text}`)

      let meta = readHeader(textPass.text)

      // 상단 머리글은 진한 배경에 흰 글씨인 경우가 많아 전체 인식에서 자주 누락된다.
      // 못 찾은 항목이 있으면 위쪽 띠만 크게 확대하고 명암을 맞춰 한 번 더 읽는다.
      if (!meta.date || !meta.teeTime || !meta.course) {
        report(0.9, '날짜·골프장 다시 읽는 중')
        try {
          const strip = await prepare(file, { scale: 3, top: 0, bottom: 0.22, autoInvert: true })
          const headPass = await recognizeWords(strip.canvas, 'text', report)
          const extra = readHeader(headPass.text)
          meta = {
            date: meta.date || extra.date,
            teeTime: meta.teeTime || extra.teeTime,
            course: extra.course && extra.course.length > meta.course.length ? extra.course : meta.course,
            courseFront: meta.courseFront || extra.courseFront,
            courseBack: meta.courseBack || extra.courseBack,
          }
          setRawText((t) => `${t}\n\n[머리글 확대]\n${headPass.text}`)
        } catch {
          // 보조 수단이라 실패해도 본 결과로 진행한다
        }
      }

      const { blocks } = buildTable({ textWords: textPass.words, digitWords: digitPass.words })

      if (blocks.length === 0) {
        setPhase('error')
        setError('스코어카드의 PAR 행을 찾지 못했습니다. 표 전체가 잘리지 않게 다시 찍어 주세요. 아래 표에 직접 입력해도 됩니다.')
        setShowText(true)
        return
      }

      const nines = blocks.slice(0, 2).map(normalizeBlock)
      // 표 위 띠에서 읽은 코스 이름이 있으면 그쪽을 우선한다
      meta = {
        ...meta,
        courseFront: nines[0]?.courseName || meta.courseFront,
        courseBack: nines[1]?.courseName || meta.courseBack,
      }

      const merged = mergeNines(nines)
      if (merged.rows.length === 0) {
        setPhase('error')
        setError('플레이어 행을 찾지 못했습니다. 이름이 나오도록 다시 찍어 주세요.')
        setShowText(true)
        return
      }

      // 후보가 하나뿐인 행만 자동으로 지정한다 (최** 두 명은 사용자가 골라야 한다)
      const auto = {}
      const taken = new Set()
      merged.rows.forEach((r, i) => {
        const candidates = nameCandidates(r.label).filter((m) => !taken.has(m))
        if (candidates.length === 1) {
          auto[i] = candidates[0]
          taken.add(candidates[0])
        } else {
          auto[i] = ''
        }
      })

      setResult({ meta, ...merged })
      setAssign(auto)
      setPhase('mapping')
    } catch (e) {
      setPhase('error')
      setError(`스코어카드를 읽지 못했습니다: ${e.message}. 아래 표에 직접 입력해 주세요.`)
    }
  }

  const checks = useMemo(() => {
    if (!result) return []
    return result.rows.map((r) => checkRow(result.pars, r.overs, r.nineTotals))
  }, [result])

  const choose = (index, member) =>
    setAssign((prev) => {
      const next = { ...prev }
      if (member) {
        // 한 사람을 두 행에 붙일 수는 없다 — 이미 쓰였으면 서로 바꾼다
        const held = Object.keys(next).find((k) => next[k] === member && Number(k) !== index)
        if (held !== undefined) next[held] = next[index] || ''
      }
      next[index] = member
      return next
    })

  const apply = () => {
    const overs = {}
    const claimedTotals = {}

    result.rows.forEach((r, i) => {
      const m = assign[i]
      if (!m) return
      overs[m] = r.overs.slice(0, HOLES)
      const [f, b] = r.nineTotals
      claimedTotals[m] = Number.isFinite(f) && Number.isFinite(b) ? f + b : null
    })

    onDraft({ meta: result.meta, pars: result.pars.slice(0, HOLES), overs, claimedTotals })
    setPhase('done')
  }

  const assignedCount = Object.values(assign).filter(Boolean).length
  const busy = phase === 'working'

  return (
    <div className="card ocr-card">
      <div className="ocr-head">
        <h3>스코어카드 사진으로 채우기</h3>
        <span className="hint">읽은 값은 아래 표에서 고칠 수 있어요</span>
      </div>

      <div
        className={`dropzone ${dragging ? 'over' : ''} ${busy ? 'busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!busy) accept(e.dataTransfer.files)
        }}
        onClick={() => !busy && fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
        aria-label="스코어카드 사진 선택 또는 끌어다 놓기"
      >
        <span className="dz-icon" aria-hidden="true">📷</span>
        <b>{busy ? '읽는 중…' : '사진을 끌어다 놓거나 눌러서 선택'}</b>
        <span className="dz-hint">여러 장을 한 번에 올리면 한 장씩 차례로 읽습니다</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        aria-label="스코어카드 사진 선택"
        onChange={(e) => {
          // FileList 는 살아있는 참조라, value 를 비우면 같이 비어버린다. 먼저 복사한다.
          const files = [...(e.target.files || [])]
          e.target.value = ''
          accept(files)
        }}
      />

      {queued && queued.total > 1 && (
        <p className="queue-note">
          {queued.total}장 중 <b>{queued.index}번째</b> 카드
          {queue.length > 0 && ' · 저장하면 다음 장으로 넘어갑니다'}
        </p>
      )}

      {busy && (
        <div className="ocr-progress" role="status">
          <div className="bar"><span style={{ width: `${Math.round(progress.value * 100)}%` }} /></div>
          <p>{progress.note} · {Math.round(progress.value * 100)}%</p>
        </div>
      )}

      {error && <div className="notice error" role="alert">{error}</div>}
      {phase === 'done' && (
        <div className="notice info" role="status">
          아래 표에 채웠습니다. 틀린 칸을 고치고 저장하세요. <b>아직 저장되지 않았습니다.</b>
        </div>
      )}

      {phase === 'mapping' && result && (
        <div className="ocr-map">
          <p className="map-desc">
            읽어낸 줄이 <b>누구인지</b> 지정해 주세요. 카드에는 이름이 가려져 나와서 최진규·최문창은
            자동으로 구분할 수 없습니다.
          </p>

          <ul className="map-rows">
            {result.rows.map((r, i) => {
              const bad = checks[i].some((c) => c.ok === false)
              const partial = checks[i].some((c) => c.ok === null)
              return (
                <li key={i} className={bad ? 'bad' : ''}>
                  <div className="map-main">
                    <span className="map-label">{r.label}</span>
                    <select
                      value={assign[i] || ''}
                      onChange={(e) => choose(i, e.target.value)}
                      aria-label={`${r.label} 줄은 누구인지`}
                    >
                      <option value="">— 사용 안 함 —</option>
                      {MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <p className="map-nums">
                    {r.overs.map((v, k) => (
                      <span key={k} className={v === null ? 'miss' : ''}>{v === null ? '·' : v}</span>
                    ))}
                  </p>
                  <p className={`map-check ${bad ? 'error' : partial ? 'warn' : 'ok'}`}>
                    {checks[i].map((c, n) => (
                      <span key={n}>
                        {n === 0 ? '전반' : '후반'}{' '}
                        {c.ok === true && `✓ ${c.computed}`}
                        {c.ok === false && `✗ 계산 ${c.computed} ≠ 카드 ${c.claimed}`}
                        {c.ok === null && '· 확인 불가'}
                      </span>
                    ))}
                  </p>
                </li>
              )
            })}
          </ul>

          <button type="button" className="btn primary block" onClick={apply} disabled={assignedCount === 0}>
            이 내용으로 표 채우기
          </button>
        </div>
      )}

      {rawText && (
        <>
          <button type="button" className="link-btn" onClick={() => setShowText((v) => !v)}>
            {showText ? '인식된 글자 숨기기' : '인식된 글자 보기'}
          </button>
          {showText && <pre className="ocr-raw">{rawText}</pre>}
        </>
      )}

      <p className="foot-note">
        사진은 기기 밖으로 나가지 않습니다. 처음 한 번은 인식 모델을 내려받느라 시간이 걸립니다.
      </p>
    </div>
  )
}
