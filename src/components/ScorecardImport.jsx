import { useEffect, useMemo, useRef, useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { HOLES } from '../lib/holes.js'
import { prepare } from '../lib/imagePrep.js'
import { recognizeWords } from '../lib/ocr.js'
import { buildTable, nameCandidates, normalizeBlock, readHeader, readRoster } from '../lib/cardVision.js'

const totalOf = (nineTotals) =>
  nineTotals.every((v) => Number.isFinite(v)) ? nineTotals[0] + nineTotals[1] : null

const NINE = 9
const sum = (a) => a.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0)
const filled = (a) => a.filter((v) => Number.isFinite(v)).length

/**
 * 한 나인에서 딱 한 칸만 못 읽었다면 T 값으로 되돌린다.
 * 버디를 나비 아이콘 같은 그림으로 표시하는 카드가 있어 그 칸은 글자로 읽히지 않는다.
 */
function fillSingleGap(pars, overs, total, from) {
  const nine = overs.slice(from, from + NINE)
  const parNine = pars.slice(from, from + NINE)
  const missing = nine.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0)

  if (missing.length !== 1) return
  if (!Number.isFinite(total) || parNine.some((p) => !Number.isFinite(p))) return

  const value = total - sum(parNine) - sum(nine)
  if (value >= -4 && value <= 12) overs[from + missing[0]] = value
}

/**
 * 합계가 딱 2·v 만큼 크면, 값이 v 인 칸 하나의 부호가 뒤집힌 것이다.
 *
 * 버디를 나비 아이콘 안에 -1 로 그려 넣는 카드가 있는데, 그림이 글자를 가려서
 * 마이너스를 놓치고 +1 로 읽는다. 후보가 여럿이면 인식 확신도가 가장 낮은 칸을
 * 고른다 — 그림에 가려진 칸이 바로 그 칸이다.
 */
function repairFlippedSign(pars, overs, confidence, total, from) {
  const parNine = pars.slice(from, from + NINE)
  const nine = overs.slice(from, from + NINE)
  if (!Number.isFinite(total) || parNine.some((p) => !Number.isFinite(p))) return
  if (nine.some((v) => v === null)) return

  const diff = sum(parNine) + sum(nine) - total
  if (diff <= 0 || diff % 2 !== 0) return

  const value = diff / 2
  if (value < 1 || value > 4) return

  const candidates = nine
    .map((v, i) => (v === value ? i : -1))
    .filter((i) => i >= 0)
  if (candidates.length === 0) return

  const pick = candidates.reduce((lowest, i) =>
    (confidence?.[from + i] ?? 0) < (confidence?.[from + lowest] ?? 0) ? i : lowest,
  )
  overs[from + pick] = -value
}

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
    const overs = [...(f?.overs ?? pad()), ...(b?.overs ?? pad())]
    const confidence = [...(f?.confidence ?? pad()), ...(b?.confidence ?? pad())]
    const nineTotals = [f?.total ?? null, b?.total ?? null]

    fillSingleGap(pars, overs, nineTotals[0], 0)
    fillSingleGap(pars, overs, nineTotals[1], NINE)
    repairFlippedSign(pars, overs, confidence, nineTotals[0], 0)
    repairFlippedSign(pars, overs, confidence, nineTotals[1], NINE)

    rows.push({ label: f?.label || b?.label || '', overs, nineTotals })
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
  const [diag, setDiag] = useState(null)
  const [copied, setCopied] = useState(false)
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

  /** 한 가지 설정으로 읽어 본다. 표를 못 찾으면 ok:false 로 돌려준다. */
  const attempt = async (file, prep, psm, report) => {
    const prepped = await prepare(file, prep)
    const textPass = await recognizeWords(prepped.canvas, 'text', report)
    const digitPass = await recognizeWords(prepped.canvas, psm, report)
    const parsed = buildTable({ textWords: textPass.words, digitSymbols: digitPass.symbols })
    return {
      prepped, textPass, digitPass, ...parsed,
      lineHeight: parsed.lineHeight,
      score: parsed.blocks.length * 10 + (parsed.diag.playerRows ?? 0),
      ok: parsed.blocks.length >= 2 && (parsed.diag.playerRows ?? 0) >= 3,
    }
  }

  const run = async (file) => {
    if (!file) return
    setPhase('working')
    setError('')
    setResult(null)
    setRawText('')
    setDiag(null)
    setCopied(false)
    setProgress({ value: 0.02, note: '사진 준비 중' })

    try {
      const report = (value, note) => setProgress({ value, note })

      // 큰 쪽이 정확하지만 휴대폰에서는 메모리가 모자랄 수 있다.
      // 정확한 설정부터 시도하고, 표를 못 찾으면 점점 작고 다른 방식으로 물러선다.
      const plans = [
        { prep: { scale: 2, maxPixels: 1.4e7 }, psm: 'digits', note: '숫자 읽는 중' },
        { prep: { scale: 2, maxPixels: 1.4e7 }, psm: 'digitsBlock', note: '숫자 다시 읽는 중' },
        { prep: { scale: 1, maxPixels: 4e6 }, psm: 'digits', note: '작게 줄여 다시 읽는 중' },
      ]

      let best = null
      for (const [i, plan] of plans.entries()) {
        report(0.55 + i * 0.12, plan.note)
        let tried
        try {
          tried = await attempt(file, plan.prep, plan.psm, report)
        } catch (e) {
          // 큰 이미지에서 메모리가 터지는 경우가 있다. 다음(더 작은) 설정으로 넘어간다.
          if (i === plans.length - 1) throw e
          continue
        }
        if (!best || tried.score > best.score) best = tried
        if (tried.ok) break
      }

      if (!best) throw new Error('사진을 처리하지 못했습니다')

      report(0.9, '정리하는 중')
      setRawText(`[글자]\n${best.textPass.text}\n\n[숫자만]\n${best.digitPass.text}`)
      setDiag({ ...best.diag, image: `${best.prepped.source.width}×${best.prepped.source.height}` })

      let meta = readHeader(best.textPass.text)

      if (!meta.date || !meta.teeTime || !meta.course) {
        report(0.94, '날짜·골프장 다시 읽는 중')
        try {
          const strip = await prepare(file, { top: 0, bottom: 0.22, autoInvert: true, target: 2000, maxPixels: 3e6 })
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

      if (best.blocks.length === 0) {
        setPhase('error')
        setError(
          best.diag.textWords === 0
            ? '사진에서 글자를 하나도 읽지 못했습니다. 화면 캡처 원본을 그대로 올려 주세요.'
            : 'PAR 행을 찾지 못했습니다. 표 전체(PAR 행과 플레이어 이름)가 잘리지 않은 캡처가 필요합니다.',
        )
        setShowText(true)
        return
      }

      const nines = best.blocks.slice(0, 2).map(normalizeBlock)
      if (!meta.courseFront && !meta.courseBack) {
        meta = { ...meta, courseFront: nines[0]?.courseName || '', courseBack: nines[1]?.courseName || '' }
      }

      const merged = mergeNines(nines)

      // 표 안의 작은 이름은 흐려서 못 읽는 일이 잦다. 머리글·요약카드의
      // "이름 - 총타수" 짝과 각 줄의 총타수를 맞춰 주인을 찾는다.
      const roster = readRoster({
        textWords: best.textPass.words,
        digitSymbols: best.digitPass.symbols,
        tableTop: best.tableTop,
        lineHeight: best.lineHeight,
      })
      for (const row of merged.rows) {
        if (row.label) continue
        const total = totalOf(row.nineTotals)
        const hit = roster.find((r) => r.total === total)
        if (hit) row.label = hit.label
      }
      merged.rows.forEach((row, i) => { if (!row.label) row.label = `${i + 1}번째 줄` })

      if (merged.rows.length === 0) {
        setPhase('error')
        setError('PAR 행은 찾았지만 플레이어 행을 못 찾았습니다. 이름과 숫자가 함께 보이도록 캡처해 주세요.')
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
      const blocked = /dynamically imported module|Failed to fetch|NetworkError|importScripts|Content Security|blocked/i.test(e.message)
      setError(
        blocked
          ? '이 페이지에서는 사진 인식을 쓸 수 없습니다. 미리보기는 외부 리소스를 막고 있어서 한글 인식 모델을 받아오지 못합니다. 배포한 사이트나 로컬(npm run dev)에서 올려 주세요.'
          : `스코어카드를 읽지 못했습니다 — ${e.message}`,
      )
      setShowText(!blocked)
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

      // 성이 겹쳐 후보가 같은 줄이 딱 둘 남았다면, 하나를 고르는 순간 나머지는 정해진다
      if (member && result) {
        const pair = nameCandidates(result.rows[index].label)
        const other = result.rows.findIndex(
          (r, i) => i !== index && !next[i] &&
            JSON.stringify(nameCandidates(r.label)) === JSON.stringify(pair),
        )
        if (other !== -1 && pair.length === 2) {
          next[other] = pair.find((m) => m !== member) || ''
        }
      }
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
  const unresolved = result ? result.rows.filter((_, i) => !assign[i]) : []
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

      {error && (
        <div className="notice error" role="alert">
          {error}
          {diag && (
            <>
            <span className="diag">
              읽은 값: 글자 {diag.textWords}개 · 숫자 {diag.digitSymbols}개 · 줄 {diag.textRows}개 ·
              PAR 행 {diag.parRows}개 · 이름 후보 {diag.nameRows}개
              {diag.playerRows !== undefined && ` · 플레이어 행 ${diag.playerRows}개`}
              {diag.image && ` · 사진 ${diag.image}`}
            </span>
            <button
              type="button"
              className="btn sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                const report = [
                  error,
                  `읽은 값: 글자 ${diag.textWords} · 숫자 ${diag.digitSymbols} · 줄 ${diag.textRows} · 격자줄 ${diag.gridRows ?? '-'} · PAR ${diag.parRows} · 이름후보 ${diag.nameRows} · 플레이어 ${diag.playerRows ?? '-'} · 사진 ${diag.image}`,
                  '',
                  rawText,
                ].join('\n')
                navigator.clipboard?.writeText(report).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }}
            >
              {copied ? '복사됨 — 붙여넣어 알려주세요' : '진단 정보 복사'}
            </button>
            </>
          )}
        </div>
      )}
      {phase === 'done' && (
        <div className="notice info" role="status">
          아래 표에 채웠습니다. 틀린 칸을 고치고 저장하세요. <b>아직 저장되지 않았습니다.</b>
        </div>
      )}

      {phase === 'mapping' && result && (
        <div className="ocr-map">
          <p className="map-desc">
            {unresolved.length === 0 ? (
              <>모든 줄을 알아냈습니다. 아래 값을 확인하고 표에 채우세요.</>
            ) : nameCandidates(unresolved[0].label).length === 0 ? (
              <>
                카드에서 <b>이름을 읽지 못했습니다</b>. 각 줄의 <b>총타수</b>를 보고 누구인지
                골라 주세요.
              </>
            ) : (
              <>
                카드에 <b>{unresolved[0].label}</b> 가 두 줄이라 앱이 구분할 수 없습니다.{' '}
                <b>{totalOf(unresolved[0].nineTotals) ?? '?'}타</b>를 친 쪽이 누구인지만 골라 주세요.
                나머지는 자동으로 채워집니다.
              </>
            )}
          </p>

          <ul className="map-rows">
            {result.rows.map((r, i) => {
              const bad = checks[i].some((c) => c.ok === false)
              const partial = checks[i].some((c) => c.ok === null)
              return (
                <li key={i} className={bad ? 'bad' : ''}>
                  <div className="map-main">
                    <span className="map-label">{r.label}</span>
                    <span className="map-total">{totalOf(r.nineTotals) ?? '–'}<small>타</small></span>
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
                        {c.ok === false && `✗ 계산 ${c.computed} ≠ 카드 ${c.claimed} (${c.computed > c.claimed ? '+' : ''}${c.computed - c.claimed}타)`}
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
