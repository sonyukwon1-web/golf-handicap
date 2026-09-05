/**
 * 지금 맞춰졌는가만 알린다 — **누를 것은 없다.**
 *
 * 연결 코드를 만들어 다른 기기에 옮겨 적게 했더니 그 한 걸음이 곧 '안 쓰는
 * 이유' 가 됐다. 넷이 쓰는 앱이라 방을 나눌 까닭도 없어서, 열면 바로 맞춰지게
 * 했다. 그래도 **지금 서버와 맞는 상태인지**는 보여야 한다 — 안 맞는 줄 모르고
 * 적으면 나중에 한쪽이 덮인다.
 */
export default function DeviceSync({ state }) {
  const kind = state?.kind || 'working'
  const 글 = {
    working: '맞추는 중…',
    ok: state?.at
      ? `${new Date(state.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 에 맞췄습니다`
      : '맞췄습니다',
    error: state?.message || '맞추지 못했습니다',
  }[kind]

  return (
    <p className={`sync-line ${kind}`} role="status">
      <i aria-hidden="true" />
      <span>
        {kind === 'error'
          ? <>{글} — 이 기기에만 저장됩니다.</>
          : <>휴대폰과 PC 가 저절로 맞춰집니다 · {글}</>}
      </span>

    </p>
  )
}
