import { MEMBERS } from '../lib/handicap.js'

/** 한 라운드의 입력 필드 묶음 (신규 입력·수정 양쪽에서 공용) */
export default function RoundFields({ value, onChange, idPrefix }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const setScore = (m, v) => set({ scores: { ...value.scores, [m]: v } })

  return (
    <>
      <div className="meta-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-date`}>날짜</label>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={value.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-course`}>골프장</label>
          <input
            id={`${idPrefix}-course`}
            type="text"
            placeholder="예: 남서울CC"
            value={value.course}
            onChange={(e) => set({ course: e.target.value })}
          />
        </div>
      </div>

      <div className="score-row">
        {MEMBERS.map((m) => (
          <div className="field score-field" key={m}>
            <label htmlFor={`${idPrefix}-${m}`}>
              <i className="swatch" style={{ '--dot': `var(--series-${MEMBERS.indexOf(m) + 1})` }} aria-hidden="true" />
              {m}
            </label>
            <input
              id={`${idPrefix}-${m}`}
              type="number"
              inputMode="numeric"
              min="50"
              max="200"
              placeholder="–"
              value={value.scores[m]}
              onChange={(e) => setScore(m, e.target.value)}
            />
          </div>
        ))}
      </div>
    </>
  )
}
