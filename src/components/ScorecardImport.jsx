import { useEffect, useMemo, useRef, useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { HOLES } from '../lib/holes.js'
import { nameCandidates } from '../lib/nameMatch.js'
import { ApiUnavailable, readScorecard } from '../lib/scorecardApi.js'

const NINE = 9
const sum = (a) => a.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0)

const totalOf = (row) =>
  Number.isFinite(row.frontTotal) && Number.isFinite(row.backTotal)
    ? row.frontTotal + row.backTotal
    : null

/** 각 9홀에 대해 PAR 합계 + 오버 합계 == T 인지 본다 */
function checkRow(pars, overs, totals) {
  return [0, NINE].map((from, n) => {
    const claimed = totals[n]
    const p = pars.slice(from, from + NINE)
    const o = overs.slice(from, from + NINE)
    if (p.some((v) => v === null) || o.some((v) => v === null) || !Number.isFinite(claimed)) {
      return { ok: null, computed: null, claimed }
    }
    const computed = sum(p) + sum(o)
    return { ok: computed === claimed, computed, claimed }
  })
}

/** 한 나인에서 딱 한 칸만 비었으면 T 값으로 되돌린다 */
function fillSingleGap(pars, overs, total, from) {
  const nine = overs.slice(from, from + NINE)
  const parNine = pars.slice(from, from + NINE)
  const missing = nine.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0)

  if (missing.length !== 1) return
  if (!Number.isFinite(total) || parNine.some((p) => p === null)) return

  const value = total - sum(parNine) - sum(nine)
  if (value >= -4 && value <= 12) overs[from + missing[0]] = value
}

/**
 * 스코어카드 사진에서 홀별 기록 초안을 만든다.
 * 어떤 경우에도 바로 저장하지 않는다 — 사용자가 표에서 확인하고 고친 뒤 저장한다.
 */
export default function ScorecardImport({ onDraft, savedTick = 0 }) {
  const [phase, setPhase] = useState('idle')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [assign, setAssign] = useState({})
  const [queue, setQueue] = useState([])
  const [queued, setQueued] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const run = async (file) => {
    if (!file) return
    setPhase('working')
    setError('')
    setResult(null)
    setNote('사진 준비 중')

    try {
      setNote('스코어카드 읽는 중 (10초쯤 걸립니다)')
      const card = await readScorecard(file)

      if (!card.rows?.length) {
        setPhase('error')
        setError('스코어카드에서 플레이어 줄을 찾지 못했습니다. 표 전체가 나오게 다시 찍어 주세요.')
        return
      }

      // 모델이 한 칸을 놓쳤다면 T 값으로 되돌린다
      for (const row of card.rows) {
        fillSingleGap(card.pars, row.overs, row.frontTotal, 0)
        fillSingleGap(card.pars, row.overs, row.backTotal, NINE)
      }

      // 후보가 하나뿐인 줄만 자동으로 지정한다 (최** 두 명은 사용자가 골라야 한다)
      const auto = {}
      const taken = new Set()
      card.rows.forEach((r, i) => {
        const candidates = nameCandidates(r.label).filter((m) => !taken.has(m))
        if (candidates.length === 1) {
          auto[i] = candidates[0]
          taken.add(candidates[0])
        } else {
          auto[i] = ''
        }
      })

      setResult(card)
      setAssign(auto)
      setPhase('mapping')
    } catch (e) {
      setPhase('error')
      setError(
        e instanceof ApiUnavailable
          ? e.message
          : `스코어카드를 읽지 못했습니다 — ${e.message}`,
      )
    }
  }

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

  const checks = useMemo(
    () => (result ? result.rows.map((r) => checkRow(result.pars, r.overs, [r.frontTotal, r.backTotal])) : []),
    [result],
  )

  const choose = (index, member) =>
    setAssign((prev) => {
      const next = { ...prev }
      if (member) {
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
        if (other !== -1 && pair.length === 2) next[other] = pair.find((m) => m !== member) || ''
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
      claimedTotals[m] = totalOf(r)
    })

    onDraft({
      meta: {
        date: result.date,
        course: result.course,
        courseFront: result.courseFront,
        courseBack: result.courseBack,
        teeTime: result.teeTime,
      },
      pars: result.pars.slice(0, HOLES),
      overs,
      claimedTotals,
    })
    setPhase('done')
  }

  const unresolved = result ? result.rows.filter((_, i) => !assign[i]) : []
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
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) accept(e.dataTransfer.files) }}
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
          <div className="bar indeterminate"><span /></div>
          <p>{note}</p>
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
            {unresolved.length === 0 ? (
              <>모든 줄을 알아냈습니다. 아래 값을 확인하고 표에 채우세요.</>
            ) : nameCandidates(unresolved[0].label).length === 0 ? (
              <>카드에서 <b>이름을 읽지 못했습니다</b>. 각 줄의 <b>총타수</b>를 보고 누구인지 골라 주세요.</>
            ) : (
              <>
                카드에 <b>{unresolved[0].label}</b> 가 두 줄이라 앱이 구분할 수 없습니다.{' '}
                <b>{totalOf(unresolved[0]) ?? '?'}타</b>를 친 쪽이 누구인지만 골라 주세요.
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
                    <span className="map-label">{r.label || `${i + 1}번째 줄`}</span>
                    <span className="map-total">{totalOf(r) ?? '–'}<small>타</small></span>
                    <select
                      value={assign[i] || ''}
                      onChange={(e) => choose(i, e.target.value)}
                      aria-label={`${r.label || `${i + 1}번째 줄`} 은 누구인지`}
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

      <p className="foot-note">
        사진은 판독에만 쓰이고 저장되지 않습니다. 읽은 값은 저장 전에 표에서 고칠 수 있어요.
      </p>
    </div>
  )
}
