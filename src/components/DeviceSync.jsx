import { useState } from 'react'
import { newRoom } from '../lib/sync.js'

/**
 * 기기 연결 — **연결 코드 하나로 휴대폰과 PC 가 같은 기록을 본다.**
 *
 * ══════════════════════════════════════════════════════════════════
 * 여태 기록도 사진도 그 기기의 브라우저에만 담겼다. 휴대폰에서 올린 사진이
 * PC 에 없고, PC 에서 넣은 라운드가 휴대폰에 없었다 — 옮기려면 파일을
 * 내보내 카톡으로 보내고 다시 불러와야 했다.
 *
 * 코드를 한 번 맞춰 두면 그 뒤로는 저절로 오간다. 앱을 열 때 받아 오고,
 * 무언가 바뀌면 잠깐 기다렸다가 올린다.
 *
 * **늦게 고친 쪽이 이긴다.** 넷이 같은 순간에 같은 라운드를 고칠 일은 없어서,
 * 문서 한 장을 통째로 주고받는 것으로 충분하다.
 * ══════════════════════════════════════════════════════════════════
 */
export default function DeviceSync({ room, state, onRoom }) {
  const [typing, setTyping] = useState('')
  const [open, setOpen] = useState(false)

  const 상태글 = {
    off: '이 기기에만 저장됩니다',
    working: '맞추는 중…',
    ok: state?.at ? `${new Date(state.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 에 맞춤` : '맞춤',
    error: state?.message || '맞추지 못했습니다',
  }[state?.kind || (room ? 'ok' : 'off')]

  return (
    <div className="card sync-card">
      <div className="fame-head">
        <h3>📱 기기 연결</h3>
        <span className={`hint ${state?.kind === 'error' ? 'sync-bad' : ''}`}>{상태글}</span>
      </div>

      {room ? (
        <>
          <p className="sync-desc">
            다른 기기에서 이 코드를 넣으면 같은 기록을 봅니다.
          </p>
          <div className="sync-code">
            <b>{room}</b>
            <button
              type="button"
              className="btn"
              onClick={() => navigator.clipboard?.writeText(room)}
            >
              복사
            </button>
            <button type="button" className="btn" onClick={() => onRoom('')}>연결 끊기</button>
          </div>
        </>
      ) : (
        <>
          <p className="sync-desc">
            휴대폰과 PC 가 같은 기록을 보게 합니다. 한쪽에서 <b>코드 만들기</b>를 누르고,
            다른 쪽에서 그 코드를 넣으세요.
          </p>
          <div className="sync-code">
            <button type="button" className="btn primary" onClick={() => onRoom(newRoom())}>
              코드 만들기
            </button>
            <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
              코드 넣기
            </button>
          </div>
          {open && (
            <div className="sync-code" style={{ marginTop: 8 }}>
              <input
                value={typing}
                onChange={(e) => setTyping(e.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 32))}
                placeholder="받은 코드"
                aria-label="연결 코드"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button
                type="button"
                className="btn primary"
                disabled={typing.length < 4}
                onClick={() => { onRoom(typing.toLowerCase()); setTyping(''); setOpen(false) }}
              >
                연결
              </button>
            </div>
          )}
        </>
      )}

      {/*
        **덮어쓰기가 있다는 것을 미리 말한다.** 코드를 넣는 순간 서버 쪽이
        더 새것이면 이 기기의 기록이 그것으로 바뀐다. 누르고 나서 알면 늦다.
      */}
      <p className="sync-note">
        연결하면 <b>더 나중에 고친 쪽</b>으로 맞춰집니다. 사진도 함께 오갑니다.
      </p>
    </div>
  )
}
