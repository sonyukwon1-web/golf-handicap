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
  order: [...MEMBERS],
})

/** 스코어카드 그대로 한 라운드를 홀별로 적는다. OCR 결과도 여기로 들어온다. */
export default function HoleRoundForm({ onSave, stats, rounds = [] }) {
  const [draft, setDraft] = useState(blank)
  const [claimedTotals, setClaimedTotals] = useState({})
  const [error, setError] = useState('')
  const [savedTick, setSavedTick] = useState(0)
  /** 카드에서 날짜를 못 읽었다 — 사람이 골라야 한다 */
  const [dateUnread, setDateUnread] = useState(false)

  const setMeta = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError('')
    if ('date' in patch) setDateUnread(false)
  }

  const applyOcr = ({ meta, pars, overs, order, claimedTotals: claimed }) => {
    /*
      ══════════════════════════════════════════════════════════
      **못 읽은 날짜를 오늘로 슬쩍 채우지 않는다.**

      여태 `meta.date || d.date` 였다. d.date 의 첫 값이 오늘이라, 카드에서
      날짜를 못 읽으면 **오늘 날짜가 조용히 들어앉았다.** 6월 27일과 28일에
      친 두 라운드를 28일에 한꺼번에 올렸더니 둘 다 28일이 된 것이 그 때문이다
      — 같은 날 같은 골프장 두 건이 되어 기록이 통째로 어긋났다.

      못 읽었으면 **비운다.** 저장은 어차피 빈 날짜를 막으므로(아래 submit),
      사람이 반드시 한 번 보게 된다.
      ══════════════════════════════════════════════════════════
    */
    setDateUnread(!meta.date)
    setDraft((d) => ({
      ...d,
      date: meta.date || '',
      course: meta.course || d.course,
      courseFront: meta.courseFront || d.courseFront,
      courseBack: meta.courseBack || d.courseBack,
      teeTime: meta.teeTime || d.teeTime,
      order: order?.length ? order : d.order,
      pars: pars.map((v, i) => (Number.isFinite(v) ? v : d.pars[i])),
      // 지정된 사람만 채우고 나머지는 비운다. 지정을 바꿨을 때 옛 값이 남으면 안 된다.
      overs: Object.fromEntries(
        MEMBERS.map((m) => [m, overs[m] ? overs[m].slice(0, HOLES) : emptyOvers()]),
      ),
    }))
    setClaimedTotals(claimed || {})
    setError('')
  }

  /*
    **같은 날 같은 골프장이 이미 있으면 물어본다.**

    36홀을 도는 일이 없진 않지만 드물다. 그보다는 카드의 날짜를 잘못 읽었을 때가
    훨씬 잦다 — 실제로 27일과 28일 라운드가 둘 다 28일로 담긴 적이 있다. 막지는
    않는다(진짜 두 번 쳤을 수 있다). 저장하기 전에 한 번 눈에 띄게만 한다.
  */
  const sameDayCourse = draft.course.trim()
    ? rounds.find((r) => r.date === draft.date && (r.course || '').trim() === draft.course.trim())
    : null

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
      order: draft.order.filter((m) => played.includes(m)),
      holes,
      scores,
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
    setDateUnread(false)
    setSavedTick((n) => n + 1) // 대기 중인 다음 스코어카드가 있으면 이어서 읽는다
  }

  return (
    <form onSubmit={submit} noValidate>
      <ScorecardImport onDraft={applyOcr} savedTick={savedTick} stats={stats} />

      {error && <div className="notice error" role="alert">{error}</div>}

      <div className="card entry-card">
        <div className="meta-grid">
          <div className="field">
            <label htmlFor="h-date">날짜</label>
            <input
              id="h-date"
              type="date"
              value={draft.date}
              onChange={(e) => setMeta({ date: e.target.value })}
              data-warn={dateUnread || undefined}
            />
            {dateUnread && <p className="field-warn">카드에서 날짜를 못 읽었습니다. 골라 주세요.</p>}
            {!dateUnread && sameDayCourse && (
              <p className="field-warn">이 날짜에 {sameDayCourse.course} 라운드가 이미 있습니다. 날짜가 맞나요?</p>
            )}
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
          playerOrder={draft.order}
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
