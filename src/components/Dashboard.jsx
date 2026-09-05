import { MEMBERS, computeStats, fmtAvg } from '../lib/handicap.js'
import { badges as computeBadges } from '../lib/awards.js'
import TrendChart from './TrendChart.jsx'
import RoundList from './RoundList.jsx'
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
 * 않는다. 이 앱에서 핸디는 넷 스코어를 낼 때 그로스에서 빼는 값이므로,
 * `−3` 이라고 적으면 91 → 88 이 그 자리에서 이어진다. 기준자는 `0`.
 * ══════════════════════════════════════════════════════════════════
 */
function HandicapRow({ s, slot, badges, photos }) {
  const [열린딱지, set열린딱지] = useState(null)
  const 설명 = badges.find((b) => b.id === 열린딱지)?.detail

  return (
    <li className="hd-row" style={{ '--dot': `var(--series-${slot})` }}>
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
      <span className="hd-stat">
        평균 <b>{fmtAvg(s.average)}</b>
        <em>{s.total}R</em>
      </span>
      {설명 && <p className="badge-detail">{설명}</p>}
      <span className="hd-num" data-base={s.isBase || undefined}>
        {/* 빼기표를 붙였더니 '−6점' 처럼 읽혀 되레 헷갈렸다 — 숫자만 적는다 */}
        {s.handicap === null ? '–' : s.handicap}
      </span>
    </li>
  )
}

export default function Dashboard({ rounds, ranking, onRanking, onUpdate, onDelete, onGoInput, sync }) {
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
            '그로스에서 빼는 타수' — 그로스가 무슨 말인지 모르면 이 줄은 아무것도
            알려 주지 않는다. 아는 사람만 아는 말을 쓰지 않는다.
          */}
          <span className="hint">최근 5경기 평균</span>
        </div>

        {/*
          ══════════════════════════════════════════════════════════
          **핸디는 켜서 보는 것이다.**

          여태 순위가 늘 핸디를 적용한 넷 스코어였다. 그런데 라운드를 막 끝내고
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
        <ul className="card hdcp-list">
          {MEMBERS
            .map((m, i) => ({ m, slot: i + 1 }))
            .sort((a, b) => (stats[a.m].handicap ?? 99) - (stats[b.m].handicap ?? 99))
            .map(({ m, slot }) => (
              <HandicapRow key={m} s={stats[m]} slot={slot} badges={badges[m]} photos={photos} />
            ))}
        </ul>
      </section>

      {rounds.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>평균 타수 추이</h2>
            <span className="hint">최근 5경기 평균</span>
          </div>
          <TrendChart rounds={rounds} />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>최근 라운드</h2>
          {rounds.length > 0 && <span className="hint">눌러서 순위 보기</span>}
        </div>
        {rounds.length === 0 ? (
          <div className="card empty">
            <strong>아직 기록이 없습니다</strong>
            첫 라운드를 입력하면 핸디캡이 자동으로 계산됩니다.
            <div style={{ marginTop: 14 }}>
              <button className="btn primary" onClick={onGoInput}>라운드 입력하기</button>
            </div>
          </div>
        ) : (
          <RoundList rounds={rounds} ranking={ranking} onUpdate={onUpdate} onDelete={onDelete} limit={5} />
        )}
      </section>

      {/* 사진은 이 자리에서 등록한다 — 등록하면 이름 나오는 모든 자리가 얼굴로 바뀐다 */}
      <PhotoPicker />

      {/* 기기 연결은 사진 바로 아래 — 둘 다 '이 기기에 담기는 것' 이야기다 */}
      {sync}
    </>
  )
}
