import Confetti from './Confetti.jsx'
import MemberAvatar, { BunkerFace } from './MemberAvatar.jsx'
import { fmtDate } from '../lib/handicap.js'
import { loadPhotos } from '../lib/photos.js'

/**
 * 라운드 저장 직후 뜨는 우승자 발표.
 *
 * 1~3위는 시상대에 세우고 **4위는 벙커에 반쯤 파묻는다.** 순위표를 한 줄씩
 * 읽히게 두는 것보다, 오늘 누가 웃고 누가 우는지가 먼저 보이는 편이 낫다.
 * 세 명 이하면 벙커 없이 시상대만 나온다.
 *
 * 색은 전부 토큰(--gold, --sand …)이라 다크 모드가 따로 필요 없다.
 */
export default function WinnerCelebration({ round, ranking, onClose }) {
  const 핸디 = ranking?.useHandicap === true
  const photos = loadPhotos()
  const score = (e) => (핸디 ? e.net : e.gross)

  const entries = round.entries
  const [first, second, third] = entries
  const last = entries.length >= 4 ? entries[entries.length - 1] : null
  const podium = [second, first, third].filter(Boolean)  // 2 · 1 · 3 순으로 세운다
  const heights = { 1: 118, 2: 80, 3: 60 }

  return (
    <div className="modal-backdrop celebrate" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Confetti run />
      <div className="modal winner-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title">
        <p className="winner-eyebrow">{fmtDate(round.date)} · {round.course || '골프장 미입력'}</p>
        <h2 id="winner-title" style={{ font: '800 26px/1.2 Pretendard, sans-serif', color: 'var(--ink)', letterSpacing: '-.03em', margin: '4px 0 2px' }}>
          오늘의 시상식 🎉
        </h2>
        <p className="hint" style={{ margin: 0 }}>{핸디 ? '핸디 적용' : '친 타수 그대로'}</p>

        {/* 시상대 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 9, marginTop: 22 }}>
          {podium.map((e) => {
            const win = e.rank === 1
            return (
              <div key={e.member} className="rise" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: win ? 116 : 100 }}>
                {win && (
                  <span style={{ font: '800 9.5px Pretendard, sans-serif', letterSpacing: '.14em', color: '#5c4300', background: 'linear-gradient(180deg, var(--gold-light), var(--gold))', padding: '5px 12px', borderRadius: 99, marginBottom: 8, whiteSpace: 'nowrap' }}>
                    CHAMPION
                  </span>
                )}
                <MemberAvatar member={e.member} src={photos[e.member]} size={win ? 84 : 58} rank={e.rank} />
                <div style={{ font: `${win ? 800 : 700} ${win ? 15 : 13}px Pretendard, sans-serif`, color: 'var(--ink)', marginTop: 8, whiteSpace: 'nowrap' }}>
                  {e.member}
                </div>
                <div style={{
                  width: '100%', height: heights[e.rank] || 60, marginTop: 8,
                  borderRadius: '16px 16px 0 0', background: 'var(--surface)',
                  border: `2px solid ${win ? 'var(--gold-border)' : 'var(--line)'}`, borderBottom: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ font: `700 ${win ? 44 : 26}px Oswald, sans-serif`, color: win ? 'var(--gold)' : 'var(--ink-3)', lineHeight: 1 }}>{e.rank}</span>
                  <span style={{ font: `600 ${win ? 20 : 15}px Oswald, sans-serif`, color: 'var(--ink)', lineHeight: 1 }}>{score(e)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 꼴찌는 벙커 */}
        {last && last.rank !== 1 && (
          <div className="rise">
            <BunkerFace member={last.member} src={photos[last.member]} />
            <p style={{ textAlign: 'center', font: '700 12px Pretendard, sans-serif', color: 'var(--series-2)', margin: '2px 0 0' }}>
              {last.rank}위 {last.member} · {score(last)}타
            </p>
          </div>
        )}

        <div className="modal-foot">
          <button type="button" className="btn primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
