import { MEMBERS, computeStats, fmtAvg } from '../lib/handicap.js'
import { badges as computeBadges } from '../lib/awards.js'
import TrendChart from './TrendChart.jsx'
import TrashTalk from './TrashTalk.jsx'
import MemberAvatar from './MemberAvatar.jsx'
import PhotoPicker from './PhotoPicker.jsx'
import RankOptions from './RankOptions.jsx'
import { useState } from 'react'
import { loadPhotos } from '../lib/photos.js'

/**
 * 핸디 한 줄 — [색 점] 이름 · 뱃지 / 평균·라운드 / 빼주는 타수.
 *
 * ══════════════════════════════════════════════════════════════════
 * **카드 넉 장을 목록 한 장으로 바꿨다.**
 *
 * 사람마다 44px 짜리 숫자와 두 줄짜리 표를 세워 두었더니, 휴대폰에서 첫 화면이
 * 통째로 핸디로 채워져 정작 아래 기록이 안 보였다. 네 사람을 견주는 것이 목적인데
 * 카드로 갈라 두면 눈이 네 번 움직여야 한다 — 한 줄씩 세우면 위아래로 훑힌다.
 *
 * **숫자는 '빼주는 타수' 로 적는다.** `3 핸디` 는 그 3이 무엇인지 말해 주지
 * 않는다. 이 앱에서 핸디는 친 타수에서 빼 주는 값이므로,
 * `−3` 이라고 적으면 91 → 88 이 그 자리에서 이어진다. 기준자는 `0`.
 * ══════════════════════════════════════════════════════════════════
 */
function HandicapRow({ s, slot, badges, photos }) {
  const [열린딱지, set열린딱지] = useState(null)
  const 설명 = badges.find((b) => b.id === 열린딱지)?.detail

  return (
    <li className="hd-item" style={{ '--dot': `var(--series-${slot})` }}>
     <div className="hd-row">
      {/* 이름 앞에 얼굴 — 사진이 없으면 성 한 글자가 색 테두리 안에 뜬다 */}
      <MemberAvatar member={s.member} src={photos?.[s.member]} size={40} />
      <div className="hd-who">
        <span className="hd-name">
          {s.member}
          {s.isBase && <span className="badge">기준</span>}
        </span>
        {badges.length > 0 && (
          /*
            **딱지를 누르면 무슨 뜻인지 말해 준다.**

            '안정왕 ±3.0' 이 무슨 셈인지 알 길이 없었다. 설명을 title 로 달아
            뒀지만 그건 마우스를 올려야 뜨는 것이라, 휴대폰에서는 아예 못 본다.
            누르면 그 자리에서 한 줄로 펴진다.
          */
          <ul className="badge-row">
            {badges.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className={`chip ${b.tone}`}
                  aria-expanded={열린딱지 === b.id}
                  onClick={() => set열린딱지((v) => (v === b.id ? null : b.id))}
                >
                  <span aria-hidden="true">{b.icon}</span>
                  {b.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/*
        ══════════════════════════════════════════════════════════
        **두 수는 같은 모양의 칸에 나란히 선다.**

        오른쪽 큰 숫자가 무엇인지 아무 데도 적혀 있지 않았다 — 옆의 `5R` 이
        이름표처럼 붙어 있어서 되레 그것이 설명인 줄 읽혔다. `5R` 은 카드
        제목('최근 5라운드 평균점수')이 이미 말하고 있으니 뺀다.

        평균과 핸디를 **같은 크기·같은 폭**으로 두고 사이에 세로줄을 넣는다.
        크기를 달리하면 줄마다 숫자의 밑선이 어긋나 오와열이 깨진다.
        ══════════════════════════════════════════════════════════
      */}
      <span className="hd-cell">
        <em>평균</em>
        <b>{fmtAvg(s.average)}</b>
      </span>
      <span className="hd-cell hd-cell-cut" data-base={s.isBase || undefined}>
        <em>핸디</em>
        {/* 빼기표를 붙였더니 '−6점' 처럼 읽혀 되레 헷갈렸다 — 숫자만 적는다 */}
        <b className="hd-num">{s.handicap === null ? '–' : s.handicap}</b>
      </span>
     </div>
      {/*
        **설명은 줄(그리드) 바깥이다.**

        예전에는 이 설명이 얼굴·이름·평균·핸디와 같은 격자 안에 있으면서 '줄
        전체를 차지하라'(`grid-column: 1 / -1`)고 적혀 있었다. 그러니 딱지를
        누르는 순간 격자가 두 줄로 늘어나며 핸디 숫자가 설명 밑으로 떨어졌다 —
        `0` 이 눌러서 나온 숫자처럼 보였다. 순서를 바꾸는 것으로는 격자의
        배치 규칙에 계속 기대게 된다. 아예 격자 밖 아랫줄로 내보낸다.
      */}
      {설명 && <p className="badge-detail">{설명}</p>}
    </li>
  )
}

export default function Dashboard({ rounds, ranking, onRanking, onGoInput, sync, 번호 }) {
  const photos = loadPhotos()
  const { stats } = computeStats(rounds, ranking)
  const badges = computeBadges(rounds, ranking)

  return (
    <>
      <TrashTalk rounds={rounds} ranking={ranking} />

      <section className="section">
        <div className="section-head">
          <h2>핸디캡</h2>
          {/*
            '그로스에서 빼는 타수' 라고 적었었다 — 그로스가 무슨 말인지 모르면 아무것도
            알려 주지 않는다. 아는 사람만 아는 말을 쓰지 않는다.
          */}
          <span className="hint">최근 5경기 평균</span>
        </div>

        {/*
          ══════════════════════════════════════════════════════════
          **핸디는 켜서 보는 것이다.**

          여태 순위가 늘 핸디를 뺀 수였다. 그런데 라운드를 막 끝내고
          보는 것은 **카드에 찍힌 타수**다 — 91 을 친 사람이 86 을 친 사람보다
          위에 있으면, 셈이 맞아도 눈이 먼저 어긋난다. 기본은 순수 타수로 두고,
          핸디로 견주고 싶을 때 켠다.

          상한은 적는 대로 곧바로 다시 셈한다. 스물 몇 타씩 벌어지면 그날 아무리
          잘 쳐도 못 이기는 판이 되기 때문에, 몇 타까지 봐줄지는 그때그때 정한다.
          ══════════════════════════════════════════════════════════
        */}
        <RankOptions ranking={ranking} onRanking={onRanking} stats={stats} members={MEMBERS} />
        {/*
          **기준이 맨 위, 그 아래로 핸디가 적은 순.**

          여태 멤버를 정해 둔 차례(MEMBERS)대로 세웠다. 그러면 기준자가 둘째 줄에
          앉기도 해서, 0 을 찾으려면 네 줄을 훑어야 했다. 잘 치는 사람이 위에
          오는 것은 옆의 추이 그래프와도 같은 방향이다.

          색(slot)은 **정해 둔 차례**를 그대로 따른다 — 줄이 움직인다고 사람의
          색까지 바뀌면 그래프의 선 색과 어긋난다.
        */}
        {/*
          **무엇을 재고 있는지 상자 안에 적는다.**

          구역 제목은 '핸디캡' 인데 줄마다 큰 수는 핸디, 작은 수는 평균이라
          어느 쪽을 보는 상자인지 헷갈렸다. 재료가 무엇인지 맨 위에 적어 둔다.
        */}
        <div className="card hdcp-card">
          <strong className="hdcp-cap">최근 5라운드 평균점수</strong>
          <ul className="hdcp-list">
          {MEMBERS
            .map((m, i) => ({ m, slot: i + 1 }))
            .sort((a, b) => (stats[a.m].handicap ?? 99) - (stats[b.m].handicap ?? 99))
            .map(({ m, slot }) => (
              <HandicapRow key={m} s={stats[m]} slot={slot} badges={badges[m]} photos={photos} />
              ))}
          </ul>
        </div>
      </section>

      {rounds.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>평균 타수 추이</h2>
            <span className="hint">최근 5경기 평균</span>
          </div>
          <TrendChart rounds={rounds} 번호={번호} />
        </section>
      )}

      {/*
        **최근 라운드 목록은 여기 없다.**

        랭킹 탭 맨 위에 같은 라운드가 시상대로 서 있고, 라운드 탭에는 전체가
        있다. 같은 것을 세 자리에서 보여 주면 홈이 길어지기만 하고, 어느
        자리가 진짜인지도 흐려진다. 홈은 **핸디와 추이**만 말한다.

        기록이 하나도 없을 때만 남긴다 — 그때는 어디로 가야 하는지 알려 줄
        자리가 필요하다.
      */}
      {rounds.length === 0 && (
        <section className="section">
          <div className="card empty">
            <strong>아직 기록이 없습니다</strong>
            첫 라운드를 입력하면 핸디캡이 자동으로 계산됩니다.
            <div style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={onGoInput}>라운드 입력하기</button>
            </div>
          </div>
        </section>
      )}

      {/* 사진은 이 자리에서 등록한다 — 등록하면 이름 나오는 모든 자리가 얼굴로 바뀐다 */}
      <PhotoPicker />

      {/* 기기 연결은 사진 바로 아래 — 둘 다 '이 기기에 담기는 것' 이야기다 */}
      {sync}
    </>
  )
}
