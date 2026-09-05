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

export default function Dashboard({ rounds, onUpdate, onDelete, onGoInput }) {
  const { stats } = computeStats(rounds)
  const badges = computeBadges(rounds)

  return (
    <>
      <TrashTalk rounds={rounds} />

      <section className="section">
        <div className="section-head">
          <h2>현재 핸디캡</h2>
          <span className="hint">최근 5경기 평균 기준 · 그로스에서 빼는 타수</span>
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
          <RoundList rounds={rounds} onUpdate={onUpdate} onDelete={onDelete} limit={5} />
        )}
      </section>
    </>
  )
}
