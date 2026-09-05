import { useRef, useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { FRONT, HOLES, grossOf, overTotal, parTotal, verifyNine, verifyRow } from '../lib/holes.js'

const NINES = [
  { key: 'front', label: '전반', from: 0, to: FRONT },
  { key: 'back', label: '후반', from: FRONT, to: HOLES },
]

/** 화면에 보여줄 문자열 ↔ 저장할 숫자 */
const toText = (v) => (v === null || v === undefined ? '' : String(v))
const fmtOver = (v) => (v > 0 ? `+${v}` : String(v))
const toValue = (text) => {
  const t = text.trim()
  if (t === '' || t === '-') return null
  const n = Number(t)
  return Number.isFinite(n) ? Math.round(n) : null
}

/**
 * 한 칸.
 *
 * 값을 숫자로만 들고 있으면 "-" 를 치는 순간 숫자가 아니라서 칸이 비워진다.
 * 그래서 버디·이글을 아예 칠 수 없었다. 치는 동안에는 글자를 그대로 두고,
 * 칸에서 손을 뗐을 때만 바깥 값과 맞춘다.
 */
function Cell({ value, onChange, className, ...rest }) {
  const [text, setText] = useState(() => toText(value))
  const [editing, setEditing] = useState(false)

  if (!editing && text !== toText(value)) setText(toText(value))

  return (
    <input
      {...rest}
      className={className}
      value={text}
      onFocus={(e) => { setEditing(true); rest.onFocus?.(e); e.target.select() }}
      onBlur={() => { setEditing(false); setText(toText(value)) }}
      onChange={(e) => {
        const raw = e.target.value
        if (!/^-?\d{0,2}$/.test(raw)) return // 숫자와 맨 앞 - 만 받는다
        setText(raw)
        onChange(raw)
      }}
    />
  )
}

/**
 * 스코어카드 모양의 홀별 입력 표.
 * 셀 값은 실제 타수가 아니라 파 대비 오버 타수다 (0 = 파, -1 = 버디).
 */
export default function HoleGrid({ value, onChange, claimedTotals, claimedNines, playerOrder }) {
  const { pars, overs } = value
  const [focused, setFocused] = useState(null) // { member | 'par', index }
  const refs = useRef({})

  // 카드마다 이름 순서가 다르다. 읽어낸 순서가 있으면 그대로 따라간다.
  const members = playerOrder?.length
    ? [...playerOrder, ...MEMBERS.filter((m) => !playerOrder.includes(m))]
    : MEMBERS

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

  const cellProps = (key, row, index) => ({
    ref: (el) => { refs.current[key] = el },
    type: 'text',
    inputMode: 'numeric',
    autoComplete: 'off',
    maxLength: 3,
    onFocus: () => setFocused({ row, index }),
  })

  const verdicts = Object.fromEntries(
    members.map((m) => [m, claimedTotals?.[m] != null ? verifyRow(pars, overs[m], claimedTotals[m]) : null]),
  )

  /*
    ══════════════════════════════════════════════════════════
    **못 읽은 칸을 그 자리에서 빨갛게 짚는다.**

    여태 '3타 차이, 인식 오류 가능성' 이라고 줄 아래에 적기만 했다. 그러면
    열여덟 칸을 카드와 하나씩 대조해야 어디가 틀렸는지 알 수 있었다.

    두 가지를 칸에 직접 표시한다 —
      · 비어 있는 칸 : 아예 못 읽은 자리다. 진한 빨간 테.
      · 합이 안 맞는 나인의 칸들 : 어느 칸인지는 알 수 없으니 아홉 칸을
        옅은 빨강으로 묶어, 그 아홉만 카드와 견주면 되게 한다.
    ══════════════════════════════════════════════════════════
  */
  const nine = (m, from, to) => verifyNine(
    pars, overs[m],
    (from === 0 ? claimedNines?.[m]?.front : claimedNines?.[m]?.back) ?? null,
    from, to,
  )

  return (
    <div className="hole-grid">
      <div className="grid-toolbar">
        <span className="grid-hint">
          칸에는 <b>파 대비 오버</b>를 넣으세요. 0 = 파, 1 = 보기, <b>-1 = 버디</b>, -2 = 이글.
        </span>
      </div>

      {NINES.map(({ key, label, from, to }) => (
        <div className="table-scroll" key={key}>
          <table className="score-grid">
            <colgroup>
              <col className="name" />
              {Array.from({ length: to - from }, (_, k) => <col className="hole" key={k} />)}
              <col className="over" />
              <col className="total" />
            </colgroup>
            <caption>{label} 9홀</caption>
            <thead>
              <tr>
                <th scope="col" className="rowhead">HOLE</th>
                {Array.from({ length: to - from }, (_, k) => (
                  <th scope="col" key={k}>{from + k + 1}</th>
                ))}
                <th scope="col" className="ocol" title="파 대비 오버 합계">±</th>
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
                      <Cell
                        {...cellProps(`par-${i}`, 'par', i)}
                        value={pars[i]}
                        onChange={(text) => setPar(i, text)}
                        aria-label={`${i + 1}번 홀 파`}
                      />
                    </td>
                  )
                })}
                <td className="ocol" />
                <td className="tcol">{parTotal(pars, from, to) || ''}</td>
              </tr>

              {members.map((m) => {
                const bad = verdicts[m]?.ok === false
                const nv = nine(m, from, to)
                /* 이 나인이 카드와 안 맞는가 — 아홉 칸을 통째로 짚는다 */
                const 나인어긋남 = nv.ok === false
                const { strokes, filled } = grossOf(pars, overs[m], from, to)
                return (
                  <tr key={m} className={bad ? 'row-bad' : ''}>
                    <th scope="row" className="rowhead">{m}</th>
                    {Array.from({ length: to - from }, (_, k) => {
                      const i = from + k
                      const v = overs[m]?.[i]
                      return (
                        <td key={i}>
                          <Cell
                            {...cellProps(`${m}-${i}`, m, i)}
                            value={v}
                            onChange={(text) => setOver(m, i, text)}
                            className={[
                              v < 0 ? 'under' : v >= 3 ? 'blowup' : '',
                              /* 못 읽은 칸이 먼저 — 어긋난 나인보다 확실한 잘못이다 */
                              nv.blanks.includes(i) ? 'unread' : 나인어긋남 ? 'suspect' : '',
                            ].filter(Boolean).join(' ')}
                            aria-label={`${m} ${i + 1}번 홀 오버 타수`}
                          />
                        </td>
                      )
                    })}
                    <td className="ocol">{filled > 0 ? fmtOver(overTotal(overs[m], from, to)) : ''}</td>
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
