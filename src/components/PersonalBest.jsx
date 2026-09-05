import { MEMBERS, fmtDate, isScore, sortRounds } from '../lib/handicap.js'
import MemberAvatar from './MemberAvatar.jsx'
import { loadPhotos } from '../lib/photos.js'

/*
  ══════════════════════════════════════════════════════════════════
  **개인 베스트는 늘 전체 라운드로 센다.**

  여태 랭킹 화면의 '개인 기록' 안에 있어서, 위쪽 보기 드롭다운을 따라 같이
  움직였다. 그런데 '내 최고 기록' 은 기간을 골라 보는 값이 아니다 — 2026년만
  골라 놓으면 그 해의 최저 타수가 베스트인 척 서 버린다.

  라운드 화면 맨 위로 옮기고, 고른 기간과 무관하게 **친 라운드 전부**에서
  가장 적게 친 한 번을 세운다.

  **워스트는 뺐다.** 자랑할 자리에 굳이 못 친 날을 나란히 적을 까닭이 없다.
  ══════════════════════════════════════════════════════════════════
*/
export default function PersonalBest({ rounds, 번호 }) {
  const photos = loadPhotos()
  const 정렬 = sortRounds(rounds)

  const 줄 = MEMBERS
    .map((m) => {
      /* 그 사람이 가장 적게 친 라운드를 통째로 붙잡는다 — 언제 어디서였는지 함께 적는다 */
      let 최고 = null
      for (const r of 정렬) {
        const v = r.scores?.[m]
        if (!isScore(v)) continue
        if (!최고 || v < 최고.gross) 최고 = { gross: v, round: r }
      }
      const 친횟수 = 정렬.filter((r) => isScore(r.scores?.[m])).length
      return 최고 ? { member: m, ...최고, played: 친횟수 } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.gross - b.gross)

  if (줄.length === 0) return null

  return (
    <div className="card fame-card best-card">
      <div className="fame-head">
        <h3>🏅 개인 베스트</h3>
        <span className="hint">전체 라운드</span>
      </div>
      <ul className="best-list">
        {줄.map((r) => (
          <li key={r.member}>
            <MemberAvatar member={r.member} src={photos[r.member]} size={34} />
            <span className="best-who">
              <b>{r.member}</b>
              {/* 언제 어디서 친 것인지 — 숫자만 있으면 자랑이 안 된다 */}
              <em>
                {번호?.get(r.round.id) && <i className="round-no sm">{번호.get(r.round.id)}</i>}
                {fmtDate(r.round.date)} · {r.round.course || '골프장 미입력'}
              </em>
            </span>
            <span className="best-num">{r.gross}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
