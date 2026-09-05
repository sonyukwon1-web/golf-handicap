import { MEMBERS, computeStats, fmtAvg } from '../lib/handicap.js'
import { badges as computeBadges } from '../lib/awards.js'
import TrendChart from './TrendChart.jsx'
import RoundList from './RoundList.jsx'
import TrashTalk from './TrashTalk.jsx'

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
function HandicapRow({ s, slot, badges }) {
  return (
    <li className="hd-row" style={{ '--dot': `var(--series-${slot})` }}>
      <i className="swatch" aria-hidden="true" />
      <div className="hd-who">
        <span className="hd-name">
          {s.member}
          {s.isBase && <span className="badge">기준</span>}
        </span>
        {badges.length > 0 && (
          <ul className="badge-row">
            {badges.map((b) => (
              <li key={b.id} className={`chip ${b.tone}`} title={b.detail || b.label}>
                <span aria-hidden="true">{b.icon}</span>
                {b.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="hd-stat">
        평균 <b>{fmtAvg(s.average)}</b>
        <em>{s.total}R</em>
      </span>
      <span className="hd-num" data-base={s.isBase || undefined}>
        {s.handicap === null ? '–' : s.handicap === 0 ? '0' : `−${s.handicap}`}
      </span>
    </li>
  )
}

export default function Dashboard({ rounds, ranking, onRanking, onUpdate, onDelete, onGoInput }) {
  const { stats } = computeStats(rounds, ranking)
  const badges = computeBadges(rounds, ranking)

  return (
    <>
      <TrashTalk rounds={rounds} ranking={ranking} />

      <section className="section">
        <div className="section-head">
          <h2>현재 핸디캡</h2>
          <span className="hint">최근 5경기 평균 기준 · 그로스에서 빼는 타수</span>
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
        <div className="rank-opts card">
          <button
            type="button"
            className={`toggle ${ranking.useHandicap ? 'on' : ''}`}
            role="switch"
            aria-checked={ranking.useHandicap}
            onClick={() => onRanking({ useHandicap: !ranking.useHandicap })}
          >
            <i aria-hidden="true" />
            <span>핸디 적용해서 순위 보기</span>
          </button>

          <label className="cap">
            <span>상한</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="54"
              placeholder="없음"
              value={ranking.cap ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim()
                const n = Number(v)
                onRanking({ cap: v === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n) })
              }}
            />
            <span className="unit">타</span>
          </label>
        </div>
        <ul className="card hdcp-list">
          {MEMBERS.map((m, i) => (
            <HandicapRow key={m} s={stats[m]} slot={i + 1} badges={badges[m]} />
          ))}
        </ul>
      </section>

      {rounds.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>평균 타수 추이</h2>
            <span className="hint">라운드마다 갱신되는 최근 5경기 평균</span>
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
    </>
  )
}
