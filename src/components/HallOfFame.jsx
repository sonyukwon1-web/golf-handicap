import { MEMBERS } from '../lib/handicap.js'
import { memberRecords } from '../lib/awards.js'

const MEDALS = ['🥇', '🥈', '🥉']
const SHAME = ['💀', '😵', '🥲']

function Ranking({ title, hint, rows, valueKey, unit, icon, tone, marks = MEDALS }) {
  if (rows.length === 0) return null

  return (
    <div className={`card fame-card ${tone}`}>
      <div className="fame-head">
        <h3>{icon} {title}</h3>
        <span className="hint">{hint}</span>
      </div>
      <ol className="fame-list">
        {rows.map((r, i) => (
          <li key={r.member}>
            <span className="fame-medal" aria-hidden="true">{marks[i] || ''}</span>
            <span className="fame-name">{r.member}</span>
            <span className="fame-bar" aria-hidden="true">
              <i style={{ width: `${rows[0][valueKey] ? (r[valueKey] / rows[0][valueKey]) * 100 : 0}%` }} />
            </span>
            <b>{r[valueKey]}<small>{unit}</small></b>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function HallOfFame({ rounds }) {
  const rec = memberRecords(rounds)
  const played = MEMBERS.filter((m) => rec[m].played > 0)

  if (played.length === 0) {
    return (
      <div className="card empty">
        <strong>아직 전당에 오를 사람이 없습니다</strong>
        라운드를 몇 번 돌고 오시죠.
      </div>
    )
  }

  const wins = played.map((m) => rec[m]).filter((r) => r.wins > 0).sort((a, b) => b.wins - a.wins)
  const lasts = played.map((m) => rec[m]).filter((r) => r.lasts > 0).sort((a, b) => b.lasts - a.lasts)

  return (
    <>
      <Ranking
        title="명예의 전당" hint="넷 스코어 1등 횟수" icon="👑" tone="fame-good"
        rows={wins} valueKey="wins" unit="승"
      />
      <Ranking
        title="흑역사관" hint="넷 스코어 꼴찌 횟수" icon="🫠" tone="fame-bad"
        rows={lasts} valueKey="lasts" unit="회" marks={SHAME}
      />

      <div className="card fame-card">
        <div className="fame-head">
          <h3>⛳ 개인 기록</h3>
          <span className="hint">그로스 기준</span>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">멤버</th>
                <th scope="col">라운드</th>
                <th scope="col">베스트</th>
                <th scope="col">워스트</th>
              </tr>
            </thead>
            <tbody>
              {played.map((m) => (
                <tr key={m}>
                  <th scope="row">{m}</th>
                  <td>{rec[m].played}</td>
                  <td className="best">{rec[m].best}</td>
                  <td className="worst">{rec[m].worst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
