import { useRef, useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { FRONT, HOLES, grossOf, parTotal, verifyRow } from '../lib/holes.js'

const NINES = [
  { key: 'front', label: '전반', from: 0, to: FRONT },
  { key: 'back', label: '후반', from: FRONT, to: HOLES },
]

/** 화면에 보여줄 문자열 ↔ 저장할 숫자 */
const toText = (v) => (v === null || v === undefined ? '' : String(v))
const toValue = (text) => {
  const t = text.trim()
  if (t === '' || t === '-') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n) : null
}

/**
 * 스코어카드 모양의 홀별 입력 표.
 * 셀 값은 실제 타수가 아니라 파 대비 오버 타수다 (0 = 파, -1 = 버디).
 */
export default function HoleGrid({ value, onChange, claimedTotals, playerOrder }) {
  const { pars, overs } = value
  const [focused, setFocused] = useState(null) // { member | 'par', index }
  const refs = useRef({})

  const members = playerOrder || MEMBERS

  const setPar = (i, text) => {
    const next = [...pars]
    next[i] = toValue(text)
    onChange({ pars: next, overs })
  }

  const setOver = (m, i, text) => {
    const row = [...(overs[m] || Array(HOLES).fill(null))]
    row[i] = toValue(text)
    onChange({ pars, overs: { ...overs, [m]: row } })
  }

  /** 마지막으로 만진 칸의 부호를 뒤집는다. 휴대폰 숫자 키패드에는 − 가 없다. */
  const flipSign = () => {
    if (!focused) return
    const { row, index } = focused
    if (row === 'par') return
    const current = overs[row]?.[index]
    if (!Number.isFinite(current) || current === 0) return
    setOver(row, index, String(-current))
    refs.current[`${row}-${index}`]?.focus()
  }

  const cellProps = (key, row, index) => ({
    ref: (el) => { refs.current[key] = el },
    type: 'text',
    inputMode: 'numeric',
    autoComplete: 'off',
    maxLength: 3,
    onFocus: (e) => { setFocused({ row, index }); e.target.select() },
  })

  const verdicts = Object.fromEntries(
    members.map((m) => [m, claimedTotals?.[m] != null ? verifyRow(pars, overs[m], claimedTotals[m]) : null]),
  )

  return (
    <div className="hole-grid">
      <div className="grid-toolbar">
        <span className="grid-hint">칸에는 <b>파 대비 오버</b>를 넣으세요 (0 = 파, -1 = 버디)</span>
        <button type="button" className="btn sm" onClick={flipSign} disabled={!focused || focused.row === 'par'}>
          ± 부호
        </button>
      </div>

      {NINES.map(({ key, label, from, to }) => (
        <div className="table-scroll" key={key}>
          <table className="score-grid">
            <caption>{label} 9홀</caption>
            <thead>
              <tr>
                <th scope="col" className="rowhead">HOLE</th>
                {Array.from({ length: to - from }, (_, k) => (
                  <th scope="col" key={k}>{from + k + 1}</th>
                ))}
                <th scope="col" className="tcol">T</th>
              </tr>
            </thead>
            <tbody>
              <tr className="par-row">
                <th scope="row" className="rowhead">PAR</th>
                {Array.from({ length: to - from }, (_, k) => {
                  const i = from + k
                  return (
                    <td key={i}>
                      <input
                        {...cellProps(`par-${i}`, 'par', i)}
                        value={toText(pars[i])}
                        onChange={(e) => setPar(i, e.target.value)}
                        aria-label={`${i + 1}번 홀 파`}
                      />
                    </td>
                  )
                })}
                <td className="tcol">{parTotal(pars, from, to) || ''}</td>
              </tr>

              {members.map((m) => {
                const bad = verdicts[m]?.ok === false
                const { strokes, filled } = grossOf(pars, overs[m], from, to)
                return (
                  <tr key={m} className={bad ? 'row-bad' : ''}>
                    <th scope="row" className="rowhead">{m}</th>
                    {Array.from({ length: to - from }, (_, k) => {
                      const i = from + k
                      const v = overs[m]?.[i]
                      return (
                        <td key={i}>
                          <input
                            {...cellProps(`${m}-${i}`, m, i)}
                            value={toText(v)}
                            onChange={(e) => setOver(m, i, e.target.value)}
                            className={v < 0 ? 'under' : v >= 3 ? 'blowup' : ''}
                            aria-label={`${m} ${i + 1}번 홀 오버 타수`}
                          />
                        </td>
                      )
                    })}
                    <td className="tcol">{filled > 0 ? strokes : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <ul className="grid-totals">
        {members.map((m) => {
          const front = grossOf(pars, overs[m], 0, FRONT)
          const back = grossOf(pars, overs[m], FRONT, HOLES)
          const v = verdicts[m]
          const done = front.filled + back.filled
          return (
            <li key={m} className={v?.ok === false ? 'bad' : ''}>
              <span className="gt-name">{m}</span>
              <span className="gt-split">전반 {front.filled ? front.strokes : '–'} · 후반 {back.filled ? back.strokes : '–'}</span>
              <b>{done > 0 ? front.strokes + back.strokes : '–'}</b>
              {done > 0 && done < HOLES && <span className="gt-warn">{HOLES - done}홀 남음</span>}
              {v?.ok === false && (
                <span className="gt-warn error">
                  카드의 T는 {v.claimed} — {Math.abs(v.computed - v.claimed)}타 차이, 인식 오류 가능성
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
