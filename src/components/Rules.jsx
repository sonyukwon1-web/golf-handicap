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
  **누가 누구에게 몇 타를 주나 — 여섯 갈래 전부.**

  화살표는 **잘 치는 쪽 → 못 치는 쪽**. 문창이 것만 그렸더니 진규·유권·지수
  끼리 붙었을 때가 안 보여, 아래 칸에 따로 목록을 하나 더 두어야 했다.
  주는 사람마다 부챗살을 하나씩 두면 그 목록이 통째로 필요 없어진다.

  마지막 사람(가장 많이 받는 이)은 줄 사람이 없어 부챗살이 없다.
*/
const 부챗살 = 핸디.slice(0, -1).map((주는이, i) => ({
  주는이,
  받는이들: 핸디.slice(i + 1).map((받는이) => ({ ...받는이, 차: 받는이.stroke - 주는이.stroke })),
}))

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
  },
  {
    icon: '💰',
    title: '상금',
    items: ['버디 — 1만원씩 지급', '이글 — 5만원', '니어 · 롱기 없음'],
  },
]

/** 12345 → '12,345' — 금액은 세 자리마다 끊어야 한 눈에 자릿수가 잡힌다 */
const 돈 = (n) => n.toLocaleString('ko-KR')

export default function Rules({ perStroke = 0, onPerStroke }) {
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
          **타당 얼마인지 적어 두면 화살표마다 금액이 함께 뜬다.**

          타수만 있으면 자리에서 다시 곱해야 했다 — 15타면 얼마더라. 한 번
          적어 두면 넷 다 같은 금액을 본다 (기기끼리 맞춰지는 값이다).
        */}
        {/*
          **기본은 비어 있다** — 그날 정한 금액을 그때 적는다.
          안 적은 동안은 초록 바탕으로 눈에 띄고, 적고 나면 조용해진다.
        */}
        <div className="per-stroke-box" data-empty={perStroke ? undefined : 'true'}>
          <label className="per-stroke">
            <span>💵 타당</span>
            <input
              inputMode="numeric"
              placeholder="금액 입력"
              value={perStroke ? 돈(perStroke) : ''}
              onChange={(e) => {
                const 숫자 = e.target.value.replace(/[^0-9]/g, '').slice(0, 8)
                onPerStroke?.(숫자 ? Number(숫자) : 0)
              }}
            />
            <em>원</em>
          </label>
        </div>

        {/*
          **주는 사람마다 부챗살 하나.**

          문창이 것 하나만 그리고 나머지는 아래에 목록으로 적었더니, 같은 것을
          두 가지 모양으로 읽어야 했다. 셋을 나란히 그리면 여섯 갈래가 모두
          화살표로 보이고 목록은 사라진다.
        */}
        {부챗살.map(({ 주는이, 받는이들 }) => (
          <div className="handi-fan" key={주는이.member}>
            <div className="fan-top">
              <MemberAvatar member={주는이.member} src={photos[주는이.member]} size={38} />
              <b>{주는이.member}</b>
              <span className="fan-base">{주는이.stroke === 0 ? '기준' : `핸디 +${주는이.stroke}`}</span>
            </div>

            <ul className="fan-branches">
              {받는이들.map((r) => (
                <li key={r.member}>
                  {/* 타수는 화살표 **위**에 — 줄 끝에 두면 어느 화살표의 값인지 눈이 한 번 더 간다 */}
                  <span className="fan-tag">{r.차}타</span>
                  <i className="fan-head" aria-hidden="true" />
                  <MemberAvatar member={r.member} src={photos[r.member]} size={32} />
                  <b>{r.member}</b>
                  {perStroke > 0 && <span className="fan-won">{돈(r.차 * perStroke)}원</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="rules-note">
          각자 차이 나는 만큼 시작할 때 서로 지급 — 화살표는 <b>주는 쪽 → 받는 쪽</b>
        </p>
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
