import { useState } from 'react'
import { MEMBERS, fmtDate } from '../lib/handicap.js'
import { headToHead } from '../lib/awards.js'

/** 두 명을 골라 1:1 상대전적을 본다. 승패는 넷 스코어 기준. */
export default function RivalMatch({ rounds }) {
  const [a, setA] = useState(MEMBERS[0])
  const [b, setB] = useState(MEMBERS[1])

  const swapIfSame = (side, value) => {
    if (side === 'a') {
      setA(value)
      if (value === b) setB(a)
    } else {
      setB(value)
      if (value === a) setA(b)
    }
  }

  const h = headToHead(rounds, a, b)
  const total = h.aWins + h.bWins || 1

  return (
    <div className="card rival-card">
      <div className="fame-head">
        <h3>⚔️ 라이벌 매치</h3>
        <span className="hint">넷 스코어 기준</span>
      </div>

      <div className="rival-pick">
        <label>
          <span className="sr-only">첫 번째 멤버</span>
          <select value={a} onChange={(e) => swapIfSame('a', e.target.value)}>
            {MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <span className="vs">VS</span>
        <label>
          <span className="sr-only">두 번째 멤버</span>
          <select value={b} onChange={(e) => swapIfSame('b', e.target.value)}>
            {MEMBERS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {h.played === 0 ? (
        <p className="rival-empty">두 분이 함께 친 라운드가 아직 없습니다.</p>
      ) : (
        <>
          <div className="rival-score">
            <span className="rs-side" data-lead={h.aWins > h.bWins}>{h.aWins}<small>승</small></span>
            <span className="rs-mid">{h.draws > 0 ? `${h.draws}무` : `${h.played}전`}</span>
            <span className="rs-side" data-lead={h.bWins > h.aWins}>{h.bWins}<small>승</small></span>
          </div>

          <div className="rival-bar" aria-hidden="true">
            <i className="ra" style={{ width: `${(h.aWins / total) * 100}%` }} />
            <i className="rb" style={{ width: `${(h.bWins / total) * 100}%` }} />
          </div>

          <p className="rival-gap">
            평균 그로스 차이{' '}
            <b>
              {h.avgGrossGap === 0
                ? '없음'
                : `${h.avgGrossGap < 0 ? a : b}가 ${Math.abs(h.avgGrossGap).toFixed(1)}타 낮음`}
            </b>
          </p>

          <div className="table-scroll">
            <table className="data">
              <caption className="sr-only">최근 맞대결</caption>
              <thead>
                <tr>
                  <th scope="col">날짜</th>
                  <th scope="col">{a}</th>
                  <th scope="col">{b}</th>
                  <th scope="col">승자</th>
                </tr>
              </thead>
              <tbody>
                {h.history.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{fmtDate(r.date)}</th>
                    <td>{r.a.gross} <small>({r.a.net})</small></td>
                    <td>{r.b.gross} <small>({r.b.net})</small></td>
                    <td>{r.winner || '무승부'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
