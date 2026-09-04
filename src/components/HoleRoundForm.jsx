import { useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { HOLES, completeTotal, emptyOvers, emptyPars, grossOf } from '../lib/holes.js'
import { fmtDate } from '../lib/handicap.js'
import { newId } from '../lib/storage.js'
import HoleGrid from './HoleGrid.jsx'
import ScorecardImport from './ScorecardImport.jsx'

const today = () => new Date().toISOString().slice(0, 10)

const blank = () => ({
  date: today(),
  course: '',
  courseFront: '',
  courseBack: '',
  teeTime: '',
  pars: emptyPars(),
  overs: Object.fromEntries(MEMBERS.map((m) => [m, emptyOvers()])),
})

/** 스코어카드 그대로 한 라운드를 홀별로 적는다. OCR 결과도 여기로 들어온다. */
export default function HoleRoundForm({ onSave }) {
  const [draft, setDraft] = useState(blank)
  const [claimedTotals, setClaimedTotals] = useState({})
  const [error, setError] = useState('')
  const [savedTick, setSavedTick] = useState(0)

  const setMeta = (patch) => { setDraft((d) => ({ ...d, ...patch })); setError('') }

  const applyOcr = ({ meta, pars, overs, claimedTotals: claimed }) => {
    setDraft((d) => ({
      ...d,
      date: meta.date || d.date,
      course: meta.course || d.course,
      courseFront: meta.courseFront || d.courseFront,
      courseBack: meta.courseBack || d.courseBack,
      teeTime: meta.teeTime || d.teeTime,
      pars: pars.map((v, i) => (Number.isFinite(v) ? v : d.pars[i])),
      overs: {
        ...d.overs,
        ...Object.fromEntries(Object.entries(overs).map(([m, row]) => [m, row.slice(0, HOLES)])),
      },
    }))
    setClaimedTotals(claimed || {})
    setError('')
  }

  const played = MEMBERS.filter((m) => grossOf(draft.pars, draft.overs[m]).filled > 0)

  const submit = (e) => {
    e.preventDefault()

    if (!draft.date) return setError('날짜를 입력해 주세요.')
    if (draft.pars.some((p) => !Number.isFinite(p))) return setError('PAR 18홀을 모두 채워 주세요.')
    if (played.length === 0) return setError('최소 한 명의 홀별 기록을 입력해 주세요.')

    const incomplete = played.filter((m) => completeTotal(draft.pars, draft.overs[m]) === null)
    if (incomplete.length > 0) {
      return setError(`${incomplete.join(', ')} — 18홀이 다 채워지지 않았습니다. 빈 칸을 채우거나 그 줄을 비워 주세요.`)
    }

    const scores = {}
    const holes = {}
    for (const m of MEMBERS) {
      const isPlayer = played.includes(m)
      scores[m] = isPlayer ? completeTotal(draft.pars, draft.overs[m]) : null
      holes[m] = isPlayer ? [...draft.overs[m]] : null
    }

    const { skipped } = onSave([{
      id: newId(),
      date: draft.date,
      course: draft.course.trim(),
      courseFront: draft.courseFront.trim(),
      courseBack: draft.courseBack.trim(),
      teeTime: draft.teeTime.trim(),
      pars: [...draft.pars],
      holes,
      scores,
      penalty: null,
      createdAt: Date.now(),
    }]) || {}

    if (skipped?.length) {
      const { existing } = skipped[0]
      setError(
        `이미 등록된 라운드입니다 — ${fmtDate(existing.date)}${existing.course ? ` ${existing.course}` : ''}. ` +
        `같은 날짜에 네 명의 타수가 모두 같습니다.`,
      )
      return
    }

    setDraft(blank())
    setClaimedTotals({})
    setError('')
    setSavedTick((n) => n + 1) // 대기 중인 다음 스코어카드가 있으면 이어서 읽는다
  }

  return (
    <form onSubmit={submit} noValidate>
      <ScorecardImport onDraft={applyOcr} savedTick={savedTick} />

      {error && <div className="notice error" role="alert">{error}</div>}

      <div className="card entry-card">
        <div className="meta-grid">
          <div className="field">
            <label htmlFor="h-date">날짜</label>
            <input id="h-date" type="date" value={draft.date} onChange={(e) => setMeta({ date: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="h-tee">티오프 <span className="opt">선택</span></label>
            <input id="h-tee" type="time" value={draft.teeTime} onChange={(e) => setMeta({ teeTime: e.target.value })} />
          </div>
          <div className="field wide">
            <label htmlFor="h-course">골프장</label>
            <input id="h-course" type="text" placeholder="예: 리앤리CC" value={draft.course}
                   onChange={(e) => setMeta({ course: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="h-front">전반 코스</label>
            <input id="h-front" type="text" placeholder="예: Sky" value={draft.courseFront}
                   onChange={(e) => setMeta({ courseFront: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="h-back">후반 코스</label>
            <input id="h-back" type="text" placeholder="예: Lake" value={draft.courseBack}
                   onChange={(e) => setMeta({ courseBack: e.target.value })} />
          </div>
        </div>

        <HoleGrid
          value={{ pars: draft.pars, overs: draft.overs }}
          onChange={({ pars, overs }) => { setDraft((d) => ({ ...d, pars, overs })); setError('') }}
          claimedTotals={claimedTotals}
        />
      </div>

      <div className="form-foot">
        <button type="button" className="btn" onClick={() => { setDraft(blank()); setClaimedTotals({}); setError('') }}>
          비우기
        </button>
        <button type="submit" className="btn primary">저장</button>
      </div>

      <p className="foot-note">
        빠진 사람은 그 줄을 비워 두세요. 총 타수는 PAR 합계 + 오버 합계로 자동 계산됩니다.
      </p>
    </form>
  )
}
