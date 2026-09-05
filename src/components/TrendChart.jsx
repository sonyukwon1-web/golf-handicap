import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MEMBER_COLORS, fmtAvg, fmtDateShort, sortRounds, trendSeries } from '../lib/handicap.js'

/* 아래 여백은 세 줄(날짜 + 골프장 두 줄)을 받는다 */
/*
  ══════════════════════════════════════════════════════════════════
  **왼쪽 눈금은 굴러가지 않는다.**

  라운드가 늘면 그래프가 가로로 길어져 밀어서 본다. 그런데 타수 눈금까지
  함께 밀려 나가 버리니, 오른쪽 라운드를 볼 때는 그 점이 몇 타쯤인지 잴
  자가 화면에 없었다. 눈금만 굴림 상자 **밖**에 따로 세워 붙박아 둔다.

  그래서 왼쪽 여백이 둘로 나뉜다 —
    AXIS      굴리지 않는 눈금 칸 (굴림 상자 밖)
    PAD.left  굴림 상자 안, 가로줄이 시작하기 전의 숨 돌릴 자리
  ══════════════════════════════════════════════════════════════════
*/
/*
  PAD.left 를 4 로 줄였더니 **첫 라운드의 골프장 이름이 왼쪽으로 잘렸다** —
  이름표는 점을 가운데 두고 좌우로 퍼지는데, 첫 점이 그림 맨 왼쪽에 붙어
  있으면 왼쪽 절반이 그림 밖으로 나간다. 이름 한 줄은 일곱 자까지 오므로
  (courseLines) 그 절반이 들어갈 만큼 둔다.
*/
const AXIS = 30
const PAD = { top: 14, right: 56, bottom: 62, left: 34 }
const HEIGHT = 260

/**
 * 골프장 이름을 x축 라벨로 — **자르지 않고 두 줄로 나눈다.**
 *
 * '롯데스카이힐…' 처럼 잘라 놓으면 어느 골프장인지 알 수 없다. 이름을 반쯤
 * 보여 주는 것은 안 보여 주는 것과 같다. 띄어쓰기가 있으면 거기서, 없으면
 * 한가운데에서 나눈다. 두 줄로도 안 되는 아주 긴 이름만 끝을 접는다.
 */
const courseLines = (name) => {
  const t = (name || '').trim()
  if (!t) return []
  if (t.length <= 7) return [t]

  const space = t.lastIndexOf(' ', Math.ceil(t.length / 2) + 2)
  const cut = space > 1 ? space : Math.ceil(t.length / 2)
  const head = t.slice(0, cut).trim()
  let tail = t.slice(space > 1 ? cut + 1 : cut).trim()
  if (tail.length > 9) tail = `${tail.slice(0, 8)}…`
  return [head, tail]
}

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    setW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function useSeriesColors() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => setDark(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return (m) => MEMBER_COLORS[m]?.[dark ? 'dark' : 'light'] ?? '#888'
}

/** 라벨이 겹치지 않도록 최소 간격을 유지하며 위아래로 밀어낸다 */
function spread(labels, min, lo, hi) {
  const sorted = [...labels].sort((a, b) => a.y - b.y)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < min) sorted[i].y = sorted[i - 1].y + min
  }
  const overflow = sorted.length ? sorted[sorted.length - 1].y - hi : 0
  if (overflow > 0) sorted.forEach((l) => (l.y = Math.max(lo, l.y - overflow)))
  return sorted
}

export default function TrendChart({ rounds, 번호 }) {
  const [wrapRef, width] = useWidth()
  const color = useSeriesColors()
  const [hover, setHover] = useState(null)
  /** 눌러서 붙잡아 둔 자리 — 손을 떼도 안 사라진다 */
  const [pinned, setPinned] = useState(null)
  const [showTable, setShowTable] = useState(false)

  const sorted = sortRounds(rounds)
  const series = trendSeries(rounds)
  const n = sorted.length

  if (n === 0 || series.length === 0) return null

  const values = series.flatMap((s) => s.points.map((p) => p.y))
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const pad = Math.max(2, (rawMax - rawMin) * 0.18)
  const yMin = Math.floor((rawMin - pad) / 5) * 5
  const yMax = Math.ceil((rawMax + pad) / 5) * 5

  /*
    ══════════════════════════════════════════════════════════
    **라운드가 늘어도 좁혀 넣지 않는다.**

    화면 폭에 맞춰 다 밀어 넣었더니 열 번을 넘어가면서 점 사이가 붙어,
    선이 뭉개지고 날짜 라벨도 거의 다 솎여 나갔다. 한 라운드에 70px 을
    보장하고, 넘치면 그래프를 가로로 늘려 굴려 보게 한다.
    ══════════════════════════════════════════════════════════
  */
  const PER_ROUND = 78
  const w = Math.max(width, 280, PAD.left + PAD.right + Math.max(0, n - 1) * PER_ROUND)
  const innerW = Math.max(1, w - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom

  const xOf = (i) => PAD.left + (n === 1 ? innerW / 2 : ((i - 1) / (n - 1)) * innerW)
  /*
    ══════════════════════════════════════════════════════════
    **위가 잘 친 쪽이다 — y축을 뒤집는다.**

    골프는 적게 칠수록 잘 친 것인데, 수를 그대로 세우면 잘 친 사람이 그래프
    바닥에 깔린다. 숫자를 아는 사람도 매번 '아래가 좋은 거였지' 를 되뇌어야
    했다. 눈이 먼저 읽는 것을 셈보다 앞에 둔다 — 작은 수가 위로 간다.
    (왼쪽 눈금 숫자도 저절로 뒤집힌다: 위가 작은 수)
    ══════════════════════════════════════════════════════════
  */
  const yOf = (v) => PAD.top + ((v - yMin) / (yMax - yMin || 1)) * innerH

  /*
    **가로줄은 5타마다.** 셋만 긋던 때는 줄 사이가 20타쯤 벌어져, 두 선이
    몇 타 차이인지 눈으로 잴 수가 없었다. 5타는 골프에서 '한 뼘' 쯤 되는
    단위라 세면서 읽힌다. 위아래 끝도 5의 배수에 맞춰 자른다.
  */
  const TICK = 5
  const tickFrom = Math.ceil(yMin / TICK) * TICK
  const ticks = []
  for (let v = tickFrom; v <= yMax; v += TICK) ticks.push(v)

  // x축 라벨은 좁은 화면에서 겹치지 않게 솎아낸다
  /*
    ══════════════════════════════════════════════════════════
    **모든 라운드에 날짜와 골프장을 적는다.**

    화면 폭에 맞춰 밀어 넣던 때는 라벨이 겹쳐서 몇 개씩 솎아 냈다. 그러면
    가운데 라운드들이 언제 어디서 친 것인지 알 길이 없었다 — 점은 있는데
    이름이 없는 셈이다.

    이제 한 라운드에 78px 을 보장하고 넘치면 가로로 굴리므로, 솎을 까닭이
    없다. 자리는 늘 있다.
    ══════════════════════════════════════════════════════════
  */
  const xLabels = sorted.map((_, i) => i)

  const endLabels = spread(
    series.map((s) => {
      const last = s.points[s.points.length - 1]
      return { member: s.member, y: yOf(last.y), value: last.y }
    }),
    13,
    PAD.top + 4,
    HEIGHT - PAD.bottom,
  )

  const pick = (clientX, rect) => {
    const x = clientX - rect.left
    let best = 0
    let bestD = Infinity
    for (let i = 1; i <= n; i++) {
      const d = Math.abs(xOf(i) - x)
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }

  /*
    **누르면 머문다.**

    갖다 댄 채로만 보이니 손을 떼는 순간 사라져, 값을 옮겨 적거나 남에게
    보여 줄 수가 없었다. 휴대폰에는 '갖다 대기' 자체가 없어 한 번 누르고
    떼면 그대로 사라졌다. 누른 자리는 다시 누르거나 빈 곳을 누를 때까지 남는다.
  */
  /*
    **끌 때는 안 띄운다.**

    그래프가 가로로 길어지면서 손가락으로 밀어 굴리게 됐는데, 누르는 순간
    값이 붙잡혀 굴리는 내내 말풍선이 따라다녔다. 누른 자리에서 얼마나
    움직였는지 재서, 거의 안 움직였을 때(6px 안쪽)만 '누른 것' 으로 본다.
  */
  const down = useRef(null)

  const onMove = (e) => {
    if (down.current) {
      down.current.moved = Math.max(down.current.moved, Math.abs(e.clientX - down.current.x))
      return
    }
    if (pinned) return
    const rect = e.currentTarget.getBoundingClientRect()
    setHover(pick(e.clientX, rect))
  }

  const onDown = (e) => {
    down.current = { x: e.clientX, moved: 0 }
  }

  const onUp = (e) => {
    const d = down.current
    down.current = null
    if (!d || d.moved > 6) return   // 굴린 것이다
    const rect = e.currentTarget.getBoundingClientRect()
    const at = pick(e.clientX, rect)
    if (pinned === at) { setPinned(null); setHover(null) }
    else { setPinned(at); setHover(at) }
  }

  const hoverRows = hover
    ? series
        .map((s) => s.points.find((p) => p.x === hover))
        .map((p, i) => (p ? { member: series[i].member, y: p.y } : null))
        .filter(Boolean)
        .sort((a, b) => a.y - b.y)
    : []

  const tipLeft = hover ? Math.min(Math.max(xOf(hover) - 66, 4), Math.max(4, w - 140)) : 0

  return (
    <div className="card chart-card">
      <div className="legend">
        {series.map((s) => (
          <span key={s.member}>
            <i className="swatch" style={{ '--dot': color(s.member) }} aria-hidden="true" />
            {s.member}
          </span>
        ))}
      </div>

      <div className="chart-row">
      {/* 붙박이 눈금 — 굴림 상자 밖이라 밀려 나가지 않는다 */}
      <svg className="chart-yaxis" width={AXIS} height={HEIGHT} viewBox={`0 0 ${AXIS} ${HEIGHT}`}
           aria-hidden="true" focusable="false">
        {ticks.map((t) => (
          <text key={t} x={AXIS - 6} y={yOf(t) + 4} textAnchor="end"
                fontSize="10.5" fill="var(--ink-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(t)}
          </text>
        ))}
      </svg>

      <div
        className="chart-wrap"
        ref={wrapRef}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={() => { down.current = null }}
        onPointerLeave={() => { down.current = null; if (!pinned) setHover(null) }}
      >
        <svg viewBox={`0 0 ${w} ${HEIGHT}`} width={w} height={HEIGHT} role="img"
             aria-label="멤버별 최근 5경기 평균 타수 추이">
          {/* 숫자는 옆 붙박이 칸이 그린다 — 여기는 선만 */}
          {ticks.map((t) => (
            <line key={t} x1={PAD.left} x2={w - PAD.right} y1={yOf(t)} y2={yOf(t)}
                  stroke="var(--line)" strokeWidth="1" />
          ))}

          {/*
            날짜 밑에 골프장 — 어느 날 어디서 친 라운드인지 그래프에서 바로 읽힌다.
            몇 번째 필드인지는 **그 위에 동그라미로** 얹는다. 여기는 그림이라
            글자 동그라미(①)를 빌려 오지 않고 진짜 원을 그린다.
          */}
          {xLabels.map((i) => (
            <g key={i}>
              {번호?.get(sorted[i].id) && (
                <>
                  <circle cx={xOf(i + 1)} cy={HEIGHT - 45} r="8"
                          fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth="1" />
                  <text x={xOf(i + 1)} y={HEIGHT - 41.5} textAnchor="middle"
                        fontSize="9.5" fontWeight="700" fill="var(--ink-3)">
                    {번호.get(sorted[i].id)}
                  </text>
                </>
              )}
              <text x={xOf(i + 1)} textAnchor="middle" fill="var(--ink-3)">
                <tspan x={xOf(i + 1)} y={HEIGHT - 27} fontSize="10.5">
                  {fmtDateShort(sorted[i].date)}
                </tspan>
                {courseLines(sorted[i].course).map((line, k) => (
                  <tspan key={k} x={xOf(i + 1)} y={HEIGHT - 15 + k * 11} fontSize="9.5">
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ))}

          {hover && (
            <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom}
                  stroke="var(--line-strong)" strokeWidth="1" />
          )}

          {series.map((s) => (
            <polyline
              key={s.member}
              fill="none"
              stroke={color(s.member)}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={s.points.map((p) => `${xOf(p.x)},${yOf(p.y)}`).join(' ')}
            />
          ))}

          {series.map((s) =>
            s.points.map((p) => {
              const on = hover === p.x || n === 1
              return (
                <circle key={`${s.member}-${p.x}`} cx={xOf(p.x)} cy={yOf(p.y)}
                        r={on ? 4.5 : 3} fill={color(s.member)}
                        stroke="var(--surface)" strokeWidth="2" />
              )
            }),
          )}

          {endLabels.map((l) => (
            <text key={l.member} x={w - PAD.right + 8} y={l.y + 3.5}
                  fontSize="11" fontWeight="700" fill="var(--ink-2)">
              {l.member}
            </text>
          ))}
        </svg>

        {hover && hoverRows.length > 0 && (
          <div className="tooltip" style={{ left: tipLeft, top: 6 }}>
            <div className="t-date">
              {fmtDateShort(sorted[hover - 1].date)} · {sorted[hover - 1].course || '골프장 미입력'}
            </div>
            {hoverRows.map((r) => (
              <div className="t-row" key={r.member}>
                <i className="swatch" style={{ '--dot': color(r.member) }} aria-hidden="true" />
                {r.member}
                <b>{fmtAvg(r.y)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      <button className="link-btn" onClick={() => setShowTable((v) => !v)}>
        {showTable ? '표 닫기' : '표로 보기'}
      </button>

      {showTable && (
        <div className="table-scroll" style={{ marginTop: 6 }}>
          <table className="data">
            <caption className="sr-only">라운드별 멤버 최근 5경기 평균 타수</caption>
            <thead>
              <tr>
                <th scope="col">날짜</th>
                {series.map((s) => (
                  <th scope="col" key={s.member}>{s.member}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id}>
                  <th scope="row">{fmtDateShort(r.date)}</th>
                  {series.map((s) => {
                    const p = s.points.find((pt) => pt.x === i + 1)
                    return <td key={s.member}>{p ? fmtAvg(p.y) : '–'}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
