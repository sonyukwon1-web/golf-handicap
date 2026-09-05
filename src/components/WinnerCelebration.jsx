import Confetti from './Confetti.jsx'
import { fmtDate } from '../lib/handicap.js'

/** 라운드 저장 직후 뜨는 우승자 발표 화면. */
export default function WinnerCelebration({ round, onPenalty, onClose }) {
  const winners = round.entries.filter((e) => e.rank === 1)
  const losers = round.losers

  return (
    <div className="modal-backdrop celebrate" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Confetti run />
      <div className="modal winner-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title">
        <p className="winner-eyebrow">{fmtDate(round.date)} · {round.course || '골프장 미입력'}</p>
        <p className="winner-trophy" aria-hidden="true">🏆</p>
        <h2 id="winner-title" className="winner-name">{winners.map((w) => w.member).join(' · ')}</h2>
        <p className="winner-sub">
          {winners[0].net}타 {winners.length > 1 ? '공동 우승' : '우승'}
        </p>

        <ol className="winner-board">
          {round.entries.map((e) => (
            <li key={e.member} data-first={e.rank === 1}>
              <span className="rank-no" data-first={e.rank === 1}>{e.rank}</span>
              <span className="wb-name">{e.member}</span>
              <span className="wb-gross">{e.gross}</span>
              <span className="wb-net">{e.net}</span>
            </li>
          ))}
        </ol>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>닫기</button>
          {losers.length > 0 && (
            <button type="button" className="btn primary" onClick={onPenalty}>🎯 벌칙 정하기</button>
          )}
        </div>
      </div>
    </div>
  )
}
