import MemberAvatar from './MemberAvatar.jsx'
import { loadPhotos } from '../lib/photos.js'

/*
  ══════════════════════════════════════════════════════════════════
  **우리 규칙 — 필드에서 말싸움 날 때 꺼내 보는 자리.**

  기록을 세는 화면(홈·랭킹·라운드)과 달리 여기는 **바뀌지 않는 약속**이다.
  넷이 합의한 그대로 적어 두고, 규칙이 바뀔 때만 이 파일을 고친다.
  ══════════════════════════════════════════════════════════════════
*/

/** 핸디 — 문창이 기준(0), 뒤로 갈수록 5타씩 */
const 핸디 = [
  { member: '최문창', stroke: 0 },
  { member: '최진규', stroke: 5 },
  { member: '손유권', stroke: 10 },
  { member: '이지수', stroke: 15 },
]

/*
  둘이 붙었을 때 누가 누구에게 몇 타를 주나.

  화살표는 **잘 치는 쪽 → 못 치는 쪽**. 여태 `문창 ↔ 지수 15타` 라고 양쪽
  화살표로만 적어 두었더니, 숫자는 맞는데 누가 주는 쪽인지가 안 보였다.
*/
const 주고받기 = 핸디.flatMap((a, i) =>
  핸디.slice(i + 1).map((b) => ({ 주는이: a.member, 받는이: b.member, 차: b.stroke - a.stroke })),
)

/** 핸디를 안 받는 사람 하나와, 그에게서 받는 나머지 — 부챗살의 뿌리와 가지 */
const [기준, ...받는이들] = 핸디

/** 넷 다 성이 다르지 않아 이름 두 자로 부른다 — 좁은 칸에 화살표까지 들어가야 한다 */
const 이름 = (m) => m.slice(1)

const 규칙 = [
  {
    icon: '💧',
    title: '해저드',
    items: ['칠 수 있으면 그대로 친다', '못 치면 1타 받고 나와서 선상에서 친다'],
  },
  {
    icon: '🚩',
    title: 'OB',
    items: ['무조건 2타 받고 선상에서 치기', '또는 그 자리에서 1타 받고 다시 치기'],
    note: '단 OB 티라도 칠 수 있으면 그냥 친다',
  },
  {
    icon: '🏖️',
    title: '벙커',
    items: ['빼고 치려면 2벌타'],
  },
  {
    icon: '🎯',
    title: '멀리건',
    items: ['전반 1개, 후반 1개'],
    note: '전반 멀리건은 후반으로 이월 불가',
  },
  {
    icon: '⛳',
    title: '퍼팅',
    items: ['퍼터 원 있을 시 — 원 안은 오케이', '퍼터 원 없을 시 — 먹갈치'],
  },
  {
    icon: '⚠️',
    title: '안전',
    items: ['캐디가 위험하다 판단 시 한 클럽 빼고 치기'],
  },
  {
    icon: '✖️',
    title: '배판',
    items: ['버디', '양파 이상', '셋 이상 동타'],
    note: '해당 홀 정산할 때 배판 — 1번 홀 치고 나서 1번 홀 스코어로 정산',
  },
  {
    icon: '💰',
    title: '상금',
    items: ['버디 — 1만원씩 지급', '이글 — 5만원', '니어 · 롱기 없음'],
  },
]

export default function Rules() {
  const photos = loadPhotos()

  return (
    <div className="rules-stack">
      {/* 핸디는 숫자라 표로, 나머지는 말이라 목록으로 — 모양이 다른 것이 자연스럽다 */}
      <div className="card fame-card">
        <div className="fame-head">
          <h3>🏌️ 핸디</h3>
          <span className="hint">최문창 기준</span>
        </div>

        {/*
          **기준 한 사람에서 부챗살로 뻗는다.**

          여태 사다리로 세워 사이마다 5타씩 달았더니, 문창이가 지수에게 몇 타를
          주는지는 5+5+5 를 머리로 더해야 나왔다. 셋 다 문창이한테서 받는 것이니
          문창이를 위에 두고 **받는 사람마다 화살표 하나**를 그린다.
        */}
        <div className="handi-fan">
          <div className="fan-top">
            <MemberAvatar member={기준.member} src={photos[기준.member]} size={38} />
            <b>{기준.member}</b>
            <span className="fan-base">기준</span>
          </div>

          <ul className="fan-branches">
            {받는이들.map((h) => (
              <li key={h.member}>
                <i className="fan-head" aria-hidden="true" />
                <MemberAvatar member={h.member} src={photos[h.member]} size={32} />
                <b>{h.member}</b>
                <span className="rules-stroke">{h.stroke}타</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="rules-note">
          각자 차이 나는 만큼 시작할 때 서로 지급 — 화살표는 <b>주는 쪽 → 받는 쪽</b>
        </p>

        <ul className="rules-pairs">
          {주고받기.map((p) => (
            <li key={`${p.주는이}-${p.받는이}`}>
              <span className="rp-who">
                {이름(p.주는이)}
                <i aria-label="가 다음 사람에게">→</i>
                {이름(p.받는이)}
              </span>
              <b>{p.차}타</b>
            </li>
          ))}
        </ul>
      </div>

      {규칙.map((g) => (
        <div className="card fame-card" key={g.title}>
          <div className="fame-head">
            <h3>{g.icon} {g.title}</h3>
          </div>
          <ul className="rules-list">
            {g.items.map((t) => <li key={t}>{t}</li>)}
          </ul>
          {g.note && <p className="rules-note">{g.note}</p>}
        </div>
      ))}
    </div>
  )
}
