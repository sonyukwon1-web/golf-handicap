import Confetti from './Confetti.jsx'
import Podium from './Podium.jsx'
import { fmtDate } from '../lib/handicap.js'

/**
 * 라운드 저장 직후 뜨는 우승자 발표.
 *
 * 1~3위는 시상대에 세우고 **4위는 벙커에 반쯤 파묻는다.** 순위표를 한 줄씩
 * 읽히게 두는 것보다, 오늘 누가 웃고 누가 우는지가 먼저 보이는 편이 낫다.
 * 세 명 이하면 벙커 없이 시상대만 나온다.
 *
 * 색은 전부 토큰(--gold, --sand …)이라 다크 모드가 따로 필요 없다.
 */
export default function WinnerCelebration({ round, onClose }) {

  return (
    <div className="modal-backdrop celebrate" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Confetti run />
      <div className="modal winner-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title">
        <p className="winner-eyebrow">{fmtDate(round.date)} · {round.course || '골프장 미입력'}</p>
        <h2 id="winner-title" style={{ font: '800 26px/1.2 Pretendard, sans-serif', color: 'var(--ink)', letterSpacing: '-.03em', margin: '4px 0 2px' }}>
          오늘의 시상식 🎉
        </h2>

        {/* 시상대와 벙커는 랭킹 화면과 **같은 부품**을 쓴다 (Podium) */}
        <Podium round={round} />

        <div className="modal-foot">
          <button type="button" className="btn primary" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
