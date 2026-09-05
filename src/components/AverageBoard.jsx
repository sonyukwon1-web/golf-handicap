import { MEMBERS, fmtAvg, isScore, scoresOf, sortRounds } from '../lib/handicap.js'
import MemberAvatar from './MemberAvatar.jsx'
import { loadPhotos } from '../lib/photos.js'

/**
 * 고른 기간의 **평균 타수 판**.
 *
 * 시상대는 '그날 누가 이겼나' 를 말하지만, 그날 잘 친 것과 요즘 잘 치는 것은
 * 다르다. 몇 라운드를 묶어 평균을 내면 그 판이 보인다.
 *
 * **친 타수 그대로 센다.** 핸디는 이 평균에서 나오는 값이라, 여기에 다시
 * 적용하면 제 꼬리를 무는 셈이다.
 */
export default function AverageBoard({ rounds, note, perMember }) {
  const photos = loadPhotos()
  const sorted = sortRounds(rounds)

  const 줄 = MEMBERS
    .map((m, i) => {
      /*
        ══════════════════════════════════════════════════════════
        **'최근 5개' 는 사람마다 다르다.**

        라운드 다섯 개를 잘라 그 안의 기록만 세면, 한 번 빠진 사람은 넷으로
        셈된다. 홈 화면의 핸디는 **그 사람이 마지막으로 친 다섯 번**을 보므로
        두 수가 어긋났다 — 같은 '최근 5개 평균' 인데 값이 달랐다.

        perMember 를 받으면 사람마다 제 마지막 다섯 번을 센다 (홈과 같은 셈).
        연도 평균은 그 해에 친 것 전부라 이 값을 안 받는다.
        ══════════════════════════════════════════════════════════
      */
      const 친것 = perMember
        ? scoresOf(sorted, m).slice(-perMember)
        : rounds.map((r) => r.scores?.[m]).filter(isScore)
      return {
        member: m,
        slot: i + 1,
        played: 친것.length,
        avg: 친것.length ? 친것.reduce((a, b) => a + b, 0) / 친것.length : null,
        best: 친것.length ? Math.min(...친것) : null,
      }
    })
    .filter((r) => r.played > 0)
    .sort((a, b) => a.avg - b.avg)

  if (줄.length === 0) {
    return (
      <div className="card empty">
        <strong>이 기간에 친 라운드가 없습니다</strong>
        다른 기간을 골라 보세요.
      </div>
    )
  }

  return (
    <ul className="card avg-board">
      {줄.map((r, i) => (
        <li key={r.member} style={{ '--dot': `var(--series-${r.slot})` }}>
          <span className="rank-num" data-first={i === 0 || undefined}>{i + 1}</span>
          <MemberAvatar member={r.member} src={photos[r.member]} size={34} rank={i + 1} />
          <span className="avg-name">{r.member}</span>
          <span className="avg-sub">
            {r.played}R · 최고 <b>{r.best}</b>
          </span>
          <b className="avg-num">{fmtAvg(r.avg)}</b>
        </li>
      ))}
      {note && <li className="avg-note">{note}</li>}
    </ul>
  )
}
