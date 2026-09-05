import MemberAvatar, { BunkerFace } from './MemberAvatar.jsx'
import { loadPhotos } from '../lib/photos.js'

/**
 * 시상대 — 2·1·3 을 세우고, 넷이 쳤으면 꼴찌를 벙커에 빠뜨린다.
 *
 * ══════════════════════════════════════════════════════════════════
 * **두 곳에서 같은 그림을 쓴다.**
 *
 *   · 라운드를 저장한 직후 뜨는 우승 발표 (WinnerCelebration)
 *   · 랭킹 화면 맨 위 — 가장 최근 라운드
 *
 * 저장 직후에만 보이던 그림이라, 닫고 나면 다시 볼 방법이 없었다. 같은 부품을
 * 두 자리에서 쓰면 한 번 고칠 때 둘 다 따라온다.
 * ══════════════════════════════════════════════════════════════════
 */
export default function Podium({ round, ranking, compact = false }) {
  const photos = loadPhotos()
  const score = (e) => e.gross

  const entries = round?.entries ?? []
  if (entries.length === 0) return null

  const [first, second, third] = entries
  const last = entries.length >= 4 ? entries[entries.length - 1] : null
  const podium = [second, first, third].filter(Boolean)   // 2 · 1 · 3 순으로 세운다
  const heights = compact ? { 1: 92, 2: 64, 3: 48 } : { 1: 118, 2: 80, 3: 60 }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 9, marginTop: compact ? 6 : 22 }}>
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

      {/* 꼴찌는 벙커 — 세 명 이하로 친 라운드면 시상대만 나온다 */}
      {last && last.rank !== 1 && (
        <div className="rise bunker-wrap">
          <BunkerFace member={last.member} src={photos[last.member]} size={compact ? 76 : 96} />

          {/*
            **깃대는 오른쪽에, 이름표는 왼쪽 아래에.**

            벙커 밑 한가운데에 '4위 이지수 · 95타' 를 적었더니 그림의 발치를
            눌러 모래 언덕이 잘려 보였다. 흰 알약으로 떼어 왼쪽 아래에 놓으면
            그림은 그림대로 서고, 누가 빠졌는지도 먼저 읽힌다.
          */}
          <span className="bunker-flag" aria-hidden="true">
            <i />
            <b>{last.rank}</b>
          </span>

          {/*
            이름표는 그림 **밑에 한 칸 띄워** 놓는다. 그림에 붙여 놓으면 모래
            언덕을 눌러 발치가 잘려 보였다.
          */}
          <p className="bunker-tag">
            {last.rank}위 {last.member} · {score(last)}타
          </p>
        </div>
      )}
    </>
  )
}
