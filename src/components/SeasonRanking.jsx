import { seasons } from '../lib/awards.js'

const THIS_YEAR = String(new Date().getFullYear())

/** 연간 포인트제: 1등 4점 · 2등 3점 · 3등 2점 · 4등 1점 */
export default function SeasonRanking({ rounds, ranking }) {
  const list = seasons(rounds, ranking)
  if (list.length === 0) return null

  const [current, ...past] = list

  return (
    <>
      <div className="card fame-card">
        <div className="fame-head">
          <h3>🏆 {current.year} 시즌</h3>
          <span className="hint">{current.rounds}라운드 · 1등 4점 … 4등 1점</span>
        </div>

        <ol className="season-list">
          {current.table.map((r, i) => (
            <li key={r.member} data-lead={i === 0}>
              <span className="fame-medal" aria-hidden="true">{['🥇', '🥈', '🥉'][i] || ''}</span>
              <span className="fame-name">{r.member}</span>
              <span className="season-played">{r.played}R</span>
              <b>{r.points}<small>점</small></b>
            </li>
          ))}
        </ol>

        {current.year === THIS_YEAR ? (
          <p className="foot-note">시즌 진행 중입니다. 연말에 챔피언이 확정됩니다.</p>
        ) : (
          <p className="foot-note">시즌 챔피언: <b>{current.champions.join(' · ')}</b></p>
        )}
      </div>

      {past.length > 0 && (
        <div className="card fame-card">
          <div className="fame-head">
            <h3>📜 역대 시즌 챔피언</h3>
            <span className="hint">지난 시즌 기록</span>
          </div>
          <ul className="champion-list">
            {past.map((s) => (
              <li key={s.year}>
                <span className="champ-year">{s.year}</span>
                <span className="champ-name">👑 {s.champions.join(' · ')}</span>
                <span className="champ-pts">{s.table[0].points}점 · {s.rounds}R</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
