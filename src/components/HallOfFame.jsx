import { MEMBERS } from '../lib/handicap.js'
import { memberRecords } from '../lib/awards.js'
import { holeStats } from '../lib/holes.js'

const fmt1 = (v) => (v === null || v === undefined ? '–' : (v > 0 ? '+' : '') + v.toFixed(1))

/** 홀별 기록이 쌓여야 나오는 통계 */
function HoleAwards({ rounds }) {
  const s = holeStats(rounds)
  if (!s) return null

  const cards = [
    s.par3 && { icon: '🎯', title: '파3 킬러', who: s.par3[0], value: `평균 ${fmt1(s.par3[1])}타`, hint: '파3 홀 평균 오버' },
    s.par5 && { icon: '🚀', title: '파5 킬러', who: s.par5[0], value: `평균 ${fmt1(s.par5[1])}타`, hint: '파5 홀 평균 오버' },
    s.collapse && { icon: '📉', title: '후반 무너짐', who: s.collapse[0], value: `${fmt1(s.collapse[1])}타`, hint: '전반 대비 후반 평균' },
    s.birdie && { icon: '🐦', title: '버디 사냥꾼', who: s.birdie[0], value: `${s.birdie[1]}회`, hint: '버디 이상' },
    s.doublePar && { icon: '🍆', title: '양파왕', who: s.doublePar[0], value: `${s.doublePar[1]}회`, hint: '파의 두 배 타수' },
  ].filter(Boolean)

  if (cards.length === 0) return null

  return (
    <div className="card fame-card">
      <div className="fame-head">
        <h3>📋 홀별 기록 통계</h3>
        <span className="hint">{s.rounds}라운드 홀별 기준</span>
      </div>

      <ul className="hole-awards">
        {cards.map((c) => (
          <li key={c.title}>
            <span className="ha-icon" aria-hidden="true">{c.icon}</span>
            <span className="ha-body">
              <span className="ha-title">{c.title}</span>
              <span className="ha-hint">{c.hint}</span>
            </span>
            <span className="ha-who">{c.who}</span>
            <b>{c.value}</b>
          </li>
        ))}
      </ul>

      <div className="table-scroll">
        <table className="data">
          <caption className="sr-only">멤버별 홀 통계</caption>
          <thead>
            <tr>
              <th scope="col">멤버</th>
              <th scope="col">홀</th>
              <th scope="col">파3</th>
              <th scope="col">파5</th>
              <th scope="col">전후반차</th>
              <th scope="col">버디</th>
              <th scope="col">양파</th>
            </tr>
          </thead>
          <tbody>
            {s.table.map((r) => (
              <tr key={r.member}>
                <th scope="row">{r.member}</th>
                <td>{r.holes}</td>
                <td>{fmt1(r.par3)}</td>
                <td>{fmt1(r.par5)}</td>
                <td>{fmt1(r.collapse)}</td>
                <td className="best">{r.birdies}</td>
                <td className="worst">{r.doublePars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
        title="명예의 전당" hint="핸디 적용 후 1등 횟수" icon="👑" tone="fame-good"
        rows={wins} valueKey="wins" unit="승"
      />
      <Ranking
        title="흑역사관" hint="핸디 적용 후 꼴찌 횟수" icon="🫠" tone="fame-bad"
        rows={lasts} valueKey="lasts" unit="회" marks={SHAME}
      />

      <HoleAwards rounds={rounds} />

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
