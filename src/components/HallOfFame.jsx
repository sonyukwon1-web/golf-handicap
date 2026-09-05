import { MEMBERS } from '../lib/handicap.js'
import { memberRecords } from '../lib/awards.js'
import MemberAvatar from './MemberAvatar.jsx'
import { loadPhotos } from '../lib/photos.js'
import { holeStats } from '../lib/holes.js'

/*
  **반올림해서 한 자리까지만.**

  1.4444444444444444 같은 수가 그대로 찍혔다. 파 대비 타수를 소수점 열여섯 자리로
  적어 봐야 알려 주는 것이 없고, 표만 옆으로 늘어난다.
*/
const fmt1 = (v) => (v === null || v === undefined ? '–' : (v > 0 ? '+' : '') + (Math.round(v * 10) / 10).toFixed(1))

/** 홀별 기록이 쌓여야 나오는 통계 */
function HoleAwards({ rounds, period }) {
  const s = holeStats(rounds)
  if (!s) return null

  const cards = [
    s.par3 && { icon: '🎯', title: '파3 킬러', who: s.par3[0], value: `평균 ${fmt1(s.par3[1])}타`, hint: '파3 홀에서 파보다' },
    s.par4 && { icon: '🏹', title: '파4 킬러', who: s.par4[0], value: `평균 ${fmt1(s.par4[1])}타`, hint: '파4 홀에서 파보다' },
    s.par5 && { icon: '🚀', title: '파5 킬러', who: s.par5[0], value: `평균 ${fmt1(s.par5[1])}타`, hint: '파5 홀에서 파보다' },
    s.collapse && { icon: '📉', title: '후반 무너짐', who: s.collapse[0], value: `${fmt1(s.collapse[1])}타`, hint: '전반보다 후반에 더 침' },
    s.revive && { icon: '📈', title: '후반 살아남', who: s.revive[0], value: `${fmt1(s.revive[1])}타`, hint: '전반보다 후반에 덜 침' },
    s.birdie && { icon: '🐦', title: '버디 사냥꾼', who: s.birdie[0], value: `${s.birdie[1]}회`, hint: '버디 이상' },
    s.doublePar && { icon: '🧅', title: '양파왕', who: s.doublePar[0], value: `${s.doublePar[1]}회`, hint: '파의 두 배' },
  ].filter(Boolean)

  if (cards.length === 0) return null

  return (
    <div className="card fame-card">
      <div className="fame-head">
        <h3>📋 홀별 기록 통계</h3>
        {period && <span className="hint">{period}</span>}
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
              <th scope="col">파4</th>
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
                <td>{fmt1(r.par4)}</td>
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

function Ranking({ title, hint, rows, valueKey, unit, icon, tone, marks = MEDALS, photos = {} }) {
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
            {/* 메달 이모지 자리에 얼굴 — 1~3위 표시는 아바타의 rank 가 대신한다 */}
            <MemberAvatar member={r.member} src={photos[r.member]} size={34} rank={i + 1} />
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

/**
 * @param 통산  1등·꼴찌 횟수를 보여줄지. 라운드 하나를 골라 볼 때는 끈다 —
 *             바로 위 시상대가 이미 그 날 등수를 세워 놓았는데, 그 밑에
 *             '1등 횟수 1승' 을 또 적으면 같은 말을 두 번 하는 것이다.
 */
export default function HallOfFame({ rounds, period, 통산 = true }) {
  const rec = memberRecords(rounds)
  const photos = loadPhotos()
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
      {통산 && (
        <>
          <Ranking
            title="명예의 전당" hint={period ? `${period} · 1등` : '1등 횟수'} icon="👑" tone="fame-good"
            rows={wins} valueKey="wins" unit="승" photos={photos}
          />
          <Ranking
            title="흑역사관" hint={period ? `${period} · 꼴찌` : '꼴찌 횟수'} icon="🫠" tone="fame-bad"
            rows={lasts} valueKey="lasts" unit="회" marks={SHAME} photos={photos}
          />
        </>
      )}

      <HoleAwards rounds={rounds} period={period} />
    </>
  )
}
