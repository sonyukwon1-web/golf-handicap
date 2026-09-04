import { useRef, useState } from 'react'

const TURNS = 5
const SPIN_MS = 3600
const SEGMENT_COLORS = ['#1e6b3a', '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#4a3aa7', '#e87ba4', '#b3261e']

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const wedge = (cx, cy, r, a0, a1) => {
  const p0 = polar(cx, cy, r, a0)
  const p1 = polar(cx, cy, r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`
}

const short = (text) => (text.length > 7 ? `${text.slice(0, 6)}…` : text)

/** 꼴찌 벌칙 룰렛. 벌칙 목록은 여기서 바로 고칠 수 있다. */
export default function PenaltyRoulette({ losers, penalties, onChangePenalties, onDecided, onClose }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  // 공동 꼴찌면 벌칙 전에 "꼴찌 결정전"부터 돌린다
  const [finalLoser, setFinalLoser] = useState(losers.length === 1 ? losers[0] : null)
  const timer = useRef(null)

  const stage = finalLoser ? 'penalty' : 'loser'
  const slots = stage === 'loser' ? losers : penalties
  const seg = slots.length ? 360 / slots.length : 360

  const spin = () => {
    if (spinning || slots.length === 0) return
    setResult(null)
    setSpinning(true)

    const index = Math.floor(Math.random() * slots.length)
    // 뽑힌 칸의 한가운데가 위쪽 바늘에 오도록 회전량을 정한다
    setRotation(360 * TURNS - (index + 0.5) * seg)

    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setSpinning(false)
      setResult(slots[index])
    }, SPIN_MS)
  }

  /** 꼴찌 결정전이 끝나면 같은 원판을 벌칙용으로 다시 쓴다 */
  const confirmLoser = () => {
    setFinalLoser(result)
    setResult(null)
    setRotation(0)
  }

  const addPenalty = () => {
    const text = draft.trim()
    if (!text || penalties.includes(text)) return
    onChangePenalties([...penalties, text])
    setDraft('')
  }

  const removePenalty = (text) => onChangePenalties(penalties.filter((p) => p !== text))

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal roulette" role="dialog" aria-modal="true" aria-labelledby="roulette-title">
        <h2 id="roulette-title" className="modal-title">
          {stage === 'loser' ? '꼴찌 결정전' : '꼴찌 벌칙 룰렛'}
        </h2>
        <p className="modal-desc">
          {stage === 'loser' ? (
            <>넷 스코어 공동 꼴찌 <b>{losers.join(' · ')}</b>. 한 명을 가려 봅시다.</>
          ) : (
            <>오늘의 꼴찌는 <b>{finalLoser}</b>. 벌칙을 뽑아 봅시다.</>
          )}
        </p>

        {stage === 'penalty' && penalties.length === 0 ? (
          <div className="notice error">벌칙이 하나도 없습니다. 아래에서 추가해 주세요.</div>
        ) : (
          <div className="wheel-wrap">
            <div className="wheel-pin" aria-hidden="true" />
            <svg
              viewBox="0 0 200 200"
              className="wheel"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.13, 0.78, 0.16, 1)` : 'none',
              }}
              role="img"
              aria-label={`${stage === 'loser' ? '꼴찌 결정' : '벌칙'} ${slots.length}칸 룰렛`}
            >
              {slots.map((p, i) => {
                const center = (i + 0.5) * seg
                // 원판이 통째로 돌아가므로 화면에서의 실제 각도는 회전량까지 더해야 한다.
                // 아래쪽 반원에 놓이는 글자는 그대로 두면 거꾸로 보이니 180도 돌려 세운다.
                const onScreen = (((center + rotation) % 360) + 360) % 360
                const upsideDown = onScreen > 90 && onScreen < 270
                return (
                  <g key={p}>
                    <path d={wedge(100, 100, 96, i * seg, (i + 1) * seg)}
                          fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                          stroke="var(--surface)" strokeWidth="1.5" />
                    <text
                      x="100" y={upsideDown ? 168 : 34}
                      transform={`rotate(${center + (upsideDown ? 180 : 0)} 100 100)`}
                      textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff"
                    >
                      {short(p)}
                    </text>
                  </g>
                )
              })}
              <circle cx="100" cy="100" r="16" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="2" />
            </svg>
          </div>
        )}

        <div aria-live="polite" className="roulette-result">
          {result ? (
            <>
              <span className="r-label">{stage === 'loser' ? '최종 꼴찌' : '오늘의 벌칙'}</span>
              <strong>{result}</strong>
            </>
          ) : (
            <span className="r-idle">{spinning ? '돌리는 중…' : '버튼을 눌러 돌려 주세요'}</span>
          )}
        </div>

        <div className="modal-foot">
          {stage === 'penalty' && (
            <button type="button" className="btn" onClick={() => setEditing((v) => !v)}>
              벌칙 편집
            </button>
          )}
          {result ? (
            stage === 'loser' ? (
              <button type="button" className="btn primary" onClick={confirmLoser}>
                벌칙 뽑으러 가기
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => onDecided(result, finalLoser)}>
                확정
              </button>
            )
          ) : (
            <button type="button" className="btn primary" onClick={spin} disabled={spinning || slots.length === 0}>
              {spinning ? '돌리는 중…' : '돌리기'}
            </button>
          )}
        </div>

        {editing && stage === 'penalty' && (
          <div className="penalty-edit">
            <ul>
              {penalties.map((p) => (
                <li key={p}>
                  <span>{p}</span>
                  <button type="button" className="btn sm danger" onClick={() => removePenalty(p)}>삭제</button>
                </li>
              ))}
            </ul>
            <div className="penalty-add">
              <input
                type="text"
                value={draft}
                placeholder="예: 다음 라운드 그린피 내기"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPenalty())}
                aria-label="추가할 벌칙"
              />
              <button type="button" className="btn" onClick={addPenalty}>추가</button>
            </div>
          </div>
        )}

        <button type="button" className="link-btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  )
}
