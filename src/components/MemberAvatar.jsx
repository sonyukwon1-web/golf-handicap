import { MEMBER_COLORS } from '../lib/handicap.js'

/**
 * 이름이 나오는 모든 자리에 얼굴을 넣는다.
 *
 * 사진이 없으면 멤버 색 링 안에 성(姓) 한 글자만 남긴다 — 빈 회색 원보다
 * 낫고, 사진이 들어오면 그대로 대체된다.
 *
 *   size  지름(px). 32 미만은 글자가 안 읽혀 링만 남긴다.
 *   rank  1이면 금테 + 그림자. 시상대·명예의전당·라운드 카드가 같은 규칙을 쓴다.
 *   src   사진 URL. 없으면 fallback.
 */
export default function MemberAvatar({ member, size = 40, rank, src, alt }) {
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  const ring = MEMBER_COLORS[member]?.[dark ? 'dark' : 'light'] || 'var(--line)'

  return (
    <span
      className="avatar"
      data-rank={rank === 1 ? '1' : undefined}
      style={{ '--ring': ring, width: size, height: size }}
    >
      {src ? (
        <img src={src} alt={alt ?? member} />
      ) : (
        <span
          className="avatar-fallback"
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            font: `700 ${Math.round(size * 0.36)}px Pretendard, sans-serif`,
            color: ring,
          }}
        >
          {size >= 32 ? member.slice(0, 1) : ''}
        </span>
      )}
    </span>
  )
}

/**
 * 꼴찌는 벙커에 반쯤 파묻힌다.
 *
 * 모래 수면선을 한 곳으로 잡는 것이 전부다 — 얼굴을 담는 창(clip)의 아랫변과
 * 앞쪽 모래 타원의 윗변을 같은 값으로 두면 머리 위쪽 60%만 남는다.
 * 기하와 색은 podium 레퍼런스 SVG 에서 그대로 가져왔다.
 */
export function BunkerFace({ member, src, size = 96 }) {
  /*
    **얼굴을 얼마나 남길 것인가.**

    60% 는 사진이 없던 때(성 한 글자)의 값이다. 글자는 위쪽에 있어 잘려도
    읽혔는데, 진짜 얼굴을 넣으니 코 아래가 통째로 잘려 누구인지 알 수 없었다.
    턱 언저리까지 남긴다 — 모래에 잠긴 느낌은 그대로고 얼굴은 알아본다.
    (수면선은 아래 `bottom: 78` 이 잡으므로 이 값을 키우면 위로만 자란다)
  */
  const clip = Math.round(size * 0.82)

  return (
    <div className="bunker" style={{ position: 'relative', height: size * 2.4 }}>
      {/* 뒤쪽 모래 (테두리) */}
      <span style={{ position: 'absolute', left: '50%', bottom: 26, transform: 'translateX(-50%)', width: size * 2.7, height: size * 0.96, borderRadius: '50%', background: 'var(--sand)', border: '3px solid var(--sand-line)', boxSizing: 'border-box' }} />
      <span style={{ position: 'absolute', left: '50%', bottom: 34, transform: 'translateX(-50%)', width: size * 2.25, height: size * 0.69, borderRadius: '50%', background: 'var(--sand-2)' }} />

      {/* 얼굴 — 위 60%만 보인다 */}
      <div style={{ position: 'absolute', left: '50%', bottom: 78, transform: 'translateX(-50%)', width: size, height: clip, overflow: 'hidden' }}>
        <div style={{ animation: 'sinkBob 3.4s ease-in-out infinite' }}>
          <MemberAvatar member={member} src={src} size={size} />
        </div>
      </div>

      {/* 앞쪽 모래 — 윗변이 곧 수면선(bottom 78 + height 38) */}
      <span style={{ position: 'absolute', left: '50%', bottom: 40, transform: 'translateX(-50%)', width: size * 2, height: 38, borderRadius: '50%', background: 'var(--sand-2)' }} />

      {/* 눈물 */}
      <span style={{ position: 'absolute', left: '50%', bottom: 98, marginLeft: -32, width: 9, height: 12, borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', background: 'var(--rain)', animation: 'tearFall 2.1s ease-in .1s infinite' }} />
      <span style={{ position: 'absolute', left: '50%', bottom: 100, marginLeft: 24, width: 9, height: 12, borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', background: 'var(--rain)', animation: 'tearFall 2.1s ease-in 1.05s infinite' }} />

      {/* 먹구름 + 비 */}
      <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: 120, height: 32 }}>
        <span style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: 96, height: 26, borderRadius: 99, background: '#b8c4ce' }} />
        <span style={{ position: 'absolute', left: 2, top: 9, width: 52, height: 20, borderRadius: 99, background: '#c7d2db' }} />
        <span style={{ position: 'absolute', right: 2, top: 9, width: 52, height: 20, borderRadius: 99, background: '#c7d2db' }} />
      </div>
      {[-30, -12, 8, 26].map((x, i) => (
        <span
          key={x}
          style={{ position: 'absolute', left: '50%', top: 37, marginLeft: x, width: 3, height: 14, borderRadius: 2, background: 'var(--rain)', animation: `rainFall 1.1s linear ${i * 0.28}s infinite` }}
        />
      ))}
    </div>
  )
}
