import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MEMBER_COLORS, fmtAvg, fmtDateShort, sortRounds, trendSeries } from '../lib/handicap.js'

/* 아래 여백은 세 줄(날짜 + 골프장 두 줄)을 받는다 */
const PAD = { top: 14, right: 56, bottom: 50, left: 34 }
const HEIGHT = 244

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

export default function TrendChart({ rounds }) {
  const [wrapRef, width] = useWidth()
  const color = useSeriesColors()
  const [hover, setHover] = useState(null)
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

  const w = Math.max(width, 280)
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
  /* 날짜 밑에 골프장이 붙어 라벨이 넓어졌다 — 그만큼 사이를 벌려 솎는다 */
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))))
  const xLabels = sorted
    .map((r, i) => i)
    .filter((i) => i % step === 0 || i === n - 1)
    .filter((i, _, all) => i === n - 1 || xOf(n) - xOf(i + 1) > 50 || all.length === 1)

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

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHover(pick(e.clientX, rect))
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

      <div
        className="chart-wrap"
        ref={wrapRef}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${w} ${HEIGHT}`} width={w} height={HEIGHT} role="img"
             aria-label="멤버별 최근 5경기 평균 타수 추이">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={yOf(t)} y2={yOf(t)}
                    stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 7} y={yOf(t) + 4} textAnchor="end"
                    fontSize="10.5" fill="var(--ink-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(t)}
              </text>
            </g>
          ))}

          {/* 날짜 밑에 골프장 — 어느 날 어디서 친 라운드인지 그래프에서 바로 읽힌다 */}
          {xLabels.map((i) => (
            <text key={i} x={xOf(i + 1)} textAnchor="middle" fill="var(--ink-3)">
              <tspan x={xOf(i + 1)} y={HEIGHT - 34} fontSize="10.5">
                {fmtDateShort(sorted[i].date)}
              </tspan>
              {courseLines(sorted[i].course).map((line, k) => (
                <tspan key={k} x={xOf(i + 1)} y={HEIGHT - 21 + k * 11} fontSize="9.5">
                  {line}
                </tspan>
              ))}
            </text>
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
