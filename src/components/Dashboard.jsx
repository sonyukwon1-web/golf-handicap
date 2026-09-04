import { MEMBERS, computeStats, fmtAvg } from '../lib/handicap.js'
import { badges as computeBadges } from '../lib/awards.js'
import TrendChart from './TrendChart.jsx'
import RoundList from './RoundList.jsx'
import TrashTalk from './TrashTalk.jsx'

function MemberCard({ s, slot, badges }) {
  return (
    <article className="member-card" style={{ '--dot': `var(--series-${slot})` }}>
      <h3 className="member-name">
        <i className="swatch" aria-hidden="true" />
        {s.member}
        {s.isBase && <span className="badge">기준</span>}
      </h3>

      <p className="hdcp">
        {s.handicap === null ? (
          <b style={{ fontSize: 30, color: 'var(--ink-3)' }}>–</b>
        ) : (
          <>
            <b>{s.handicap}</b>
            <i>핸디</i>
          </>
        )}
      </p>

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

      <dl className="member-sub">
        <div>
          <dt>최근 {s.recentCount || 5}경기 평균</dt>
          <dd>{fmtAvg(s.average)}</dd>
        </div>
        <div>
          <dt>총 라운드</dt>
          <dd>{s.total}</dd>
        </div>
      </dl>
    </article>
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
          <span className="hint">최근 5경기 평균 기준</span>
        </div>
        <div className="member-grid">
          {MEMBERS.map((m, i) => (
            <MemberCard key={m} s={stats[m]} slot={i + 1} badges={badges[m]} />
          ))}
        </div>
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
