import { useEffect, useRef } from 'react'

const COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#ffffff']

/** 우승 발표용 색종이. 의존성 없이 캔버스로 그린다. */
export default function Confetti({ run }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = ref.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const pieces = Array.from({ length: 110 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.6,
      size: 5 + Math.random() * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      vy: 1.4 + Math.random() * 2.2,
      vx: -0.9 + Math.random() * 1.8,
      spin: -0.16 + Math.random() * 0.32,
      angle: Math.random() * Math.PI * 2,
    }))

    let raf = 0
    const started = performance.now()

    const tick = (now) => {
      const elapsed = now - started
      ctx.clearRect(0, 0, w, h)

      // 마지막 1초는 서서히 사라지게 한다
      ctx.globalAlpha = elapsed > 3000 ? Math.max(0, 1 - (elapsed - 3000) / 1000) : 1

      for (const p of pieces) {
        p.y += p.vy
        p.x += p.vx
        p.angle += p.spin

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()

        if (p.y > h + 20) {
          p.y = -20
          p.x = Math.random() * w
        }
      }

      if (elapsed < 4000) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w, h)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run])

  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}
