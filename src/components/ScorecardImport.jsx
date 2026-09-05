import { useEffect, useRef, useState } from 'react'
import { HOLES } from '../lib/holes.js'
import { nameCandidates } from '../lib/nameMatch.js'
import { ApiUnavailable, readScorecard } from '../lib/scorecardApi.js'
import NamePicker from './NamePicker.jsx'

const NINE = 9
const sum = (a) => a.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0)

const totalOf = (row) =>
  Number.isFinite(row.frontTotal) && Number.isFinite(row.backTotal)
    ? row.frontTotal + row.backTotal
    : null

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
 * 후보가 하나뿐인 줄만 확정한다 (카드 주인의 실명, 성이 겹치지 않는 이**·손**).
 *
 * 최진규·최문창처럼 성이 겹치는 묶음은 **짐작하지 않는다**. 타수가 같든 다르든
 * 카드만으로는 알 수 없으므로 사람에게 물어본다. 잘못 짐작해서 조용히 들어가는 것보다
 * 한 번 묻는 편이 낫다.
 */
function autoAssign(card) {
  const assign = {}
  const taken = new Set()

  card.rows.forEach((r, i) => {
    const candidates = nameCandidates(r.label).filter((m) => !taken.has(m))
    if (candidates.length === 1) {
      assign[i] = candidates[0]
      taken.add(candidates[0])
    } else {
      assign[i] = ''
    }
  })
  return assign
}

/**
 * 스코어카드 사진에서 홀별 기록 초안을 만든다.
 * 어떤 경우에도 바로 저장하지 않는다 — 사용자가 표에서 확인하고 고친 뒤 저장한다.
 */
export default function ScorecardImport({ onDraft, savedTick = 0 }) {
  const [phase, setPhase] = useState('idle')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // 이름을 골라야 하는 줄들
  const [queue, setQueue] = useState([])
  const [queued, setQueued] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const run = async (file) => {
    if (!file) return
    setPhase('working')
    setError('')
    setPending(null)
    setNote('사진 준비 중')

    try {
      setNote('스코어카드 읽는 중… 10초쯤 걸려요')
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

      const assign = autoAssign(card)
      fill(card, assign) // 알아낸 줄은 곧바로 표에 넣는다

      // 성이 겹쳐 카드로는 구분할 수 없는 줄만 팝업으로 묻는다
      const ask = card.rows
        .map((r, index) => ({ ...r, index, total: totalOf(r), candidates: nameCandidates(r.label) }))
        .filter((r) => !assign[r.index] && r.candidates.length > 1)

      setPhase('done')
      if (ask.length > 0) setPending({ card, assign, rows: ask })
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

  /** 지정된 줄을 아래 표에 넣는다. 따로 누를 단계를 두지 않는다. */
  const fill = (card, assign) => {
    const overs = {}
    const claimedTotals = {}
    card.rows.forEach((r, i) => {
      const m = assign[i]
      if (!m) return
      overs[m] = r.overs.slice(0, HOLES)
      claimedTotals[m] = totalOf(r)
    })

    onDraft({
      // 카드마다 이름 순서가 다르다. 표도 그 순서를 따라가게 한다.
      order: card.rows.map((_, i) => assign[i]).filter(Boolean),
      meta: {
        date: card.date,
        course: card.course,
        courseFront: card.courseFront,
        courseBack: card.courseBack,
        teeTime: card.teeTime,
      },
      pars: card.pars.slice(0, HOLES),
      overs,
      claimedTotals,
    })
  }

  const busy = phase === 'working'

  return (
    <div className="card ocr-card">
      {/* 아이폰 사파리는 숨은 file input 을 코드로 누르는 것을 막을 때가 있다.
          <label> 로 묶으면 브라우저가 스스로 사진첩을 연다. */}
      <input
        ref={fileRef}
        id="scorecard-file"
        type="file"
        accept="image/*,.heic,.heif,.jpg,.jpeg,.png"
        multiple
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          // FileList 는 살아있는 참조라, value 를 비우면 같이 비어버린다. 먼저 복사한다.
          const files = [...(e.target.files || [])]
          e.target.value = ''
          accept(files)
        }}
      />
      <label
        htmlFor="scorecard-file"
        className={`dropzone ${dragging ? 'over' : ''} ${busy ? 'busy' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) accept(e.dataTransfer.files) }}
      >
        <span className="dz-icon" aria-hidden="true">📷</span>
        <b>{busy ? '읽는 중…' : '스코어카드를 올려주세요'}</b>
        <span className="dz-hint">여러 장을 한 번에 올리면 한 장씩 차례로 읽습니다</span>
      </label>

      {queued && queued.total > 1 && (
        <p className="queue-note">
          {queued.total}장 중 <b>{queued.index}번째</b> 카드
          {queue.length > 0 && ' · 저장하면 다음 장으로 넘어갑니다'}
        </p>
      )}

      {busy && (
        <div className="ocr-progress" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>{note}</p>
        </div>
      )}

      {error && <div className="notice error" role="alert">{error}</div>}
      {phase === 'done' && !pending && (
        <div className="notice info" role="status">
          아래 표에 채웠습니다. 확인하고 <b>저장</b>을 눌러 주세요.
        </div>
      )}
      {pending && (
        <NamePicker
          rows={pending.rows}
          card={pending.card}
          onCancel={() => setPending(null)}
          onConfirm={(picks) => {
            const next = { ...pending.assign }
            pending.rows.forEach((row, i) => { if (picks[i]) next[row.index] = picks[i] })
            fill(pending.card, next)
            setPending(null)
          }}
        />
      )}

      <p className="foot-note">
        사진은 판독에만 쓰이고 저장되지 않습니다. 읽은 값은 저장 전에 표에서 고칠 수 있어요.
      </p>
    </div>
  )
}
