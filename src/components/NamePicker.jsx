import { useEffect, useRef, useState } from 'react'

const NINE = 9

/**
 * 성이 겹쳐 카드로 구분할 수 없는 줄의 주인을 고르는 팝업.
 *
 * 총타수가 같아도 홀별 기록은 다르므로, 각 줄의 스코어카드를 함께 보여 준다.
 * 그걸 봐야 누가 누군지 가릴 수 있다.
 */
export default function NamePicker({ rows, onConfirm, onCancel }) {
  const [picks, setPicks] = useState(() => rows.map(() => ''))
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  /** 두 줄에 같은 사람을 넣을 수 없다. 하나를 고르면 나머지는 저절로 정해진다. */
  const choose = (index, member) =>
    setPicks((prev) => {
      const next = prev.map((p) => (p === member ? '' : p))
      next[index] = member

      const pair = rows[index].candidates
      if (rows.length === 2 && pair.length === 2) {
        const other = index === 0 ? 1 : 0
        next[other] = pair.find((m) => m !== member) || ''
      }
      return next
    })

  const tied = rows.length === 2 && rows[0].total === rows[1].total
  const ready = picks.every(Boolean) && new Set(picks).size === picks.length

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" tabIndex={-1} ref={dialogRef}>
        <h2 id="picker-title" className="modal-title">누구의 기록인지 골라 주세요</h2>
        <p className="modal-desc">
          카드에 <b>{rows[0].label}</b> 가 두 줄이라 앱이 구분할 수 없습니다.{' '}
          {tied
            ? <>두 분의 <b>총타수가 같으니</b> 홀별 기록을 보고 골라 주세요.</>
            : <>타수를 보고 이름을 눌러 주세요.</>}
        </p>

        {rows.map((row, i) => (
          <div className={`pick-row ${picks[i] ? 'done' : ''}`} key={i}>
            <div className="pick-head">
              <span className="pick-total">{row.total ?? '–'}<small>타</small></span>
              <div className="segmented" role="group" aria-label={`${row.total ?? ''}타를 친 사람`}>
                {row.candidates.map((m) => (
                  <button
                    type="button"
                    key={m}
                    aria-pressed={picks[i] === m}
                    onClick={() => choose(i, picks[i] === m ? '' : m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <table className="map-card">
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: NINE }, (_, k) => <th key={k}>{k + 1}</th>)}
                  <th className="t">T</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '전반', from: 0, total: row.frontTotal },
                  { label: '후반', from: NINE, total: row.backTotal },
                ].map(({ label, from, total }) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {row.overs.slice(from, from + NINE).map((v, k) => (
                      <td key={k} className={v === null ? 'miss' : v < 0 ? 'under' : v >= 3 ? 'blowup' : ''}>
                        {v === null ? '·' : v}
                      </td>
                    ))}
                    <td className="t">{Number.isFinite(total) ? total : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>나중에</button>
          <button type="button" className="btn primary" onClick={() => onConfirm(picks)} disabled={!ready}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
