import { useEffect, useRef, useState } from 'react'
import { cropBounds, cropToDataUrl } from '../lib/photos.js'

const VIEW = 240

/**
 * 사진을 동그라미에 맞추는 창 — **끌어서 옮기고 늘려서 키운다.**
 *
 * 가운데를 기계적으로 자르면 사진마다 얼굴이 있는 자리가 달라 동그라미 안이
 * 배경으로 절반쯤 찬다. 사람이 한 번 맞추는 것이 어떤 자동 셈보다 정확하다.
 *
 * 미리보기와 저장이 **같은 셈**을 쓴다(lib/photos.js 의 cropToDataUrl) —
 * 보이는 그대로 저장된다.
 */
export default function PhotoCrop({ member, img, onDone, onCancel }) {
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  /* 늘렸다 줄이면 그림이 동그라미 밖으로 밀려나므로, 그때마다 안으로 당긴다 */
  useEffect(() => {
    const b = cropBounds(img, VIEW, zoom)
    setOff((o) => ({
      x: Math.max(-b.x, Math.min(b.x, o.x)),
      y: Math.max(-b.y, Math.min(b.y, o.y)),
    }))
  }, [img, zoom])

  const move = (e) => {
    if (!drag.current) return
    const b = cropBounds(img, VIEW, zoom)
    const nx = drag.current.ox + (e.clientX - drag.current.x)
    const ny = drag.current.oy + (e.clientY - drag.current.y)
    setOff({
      x: Math.max(-b.x, Math.min(b.x, nx)),
      y: Math.max(-b.y, Math.min(b.y, ny)),
    })
  }

  const base = VIEW / Math.min(img.width, img.height)
  const w = img.width * base * zoom
  const h = img.height * base * zoom

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <h2 id="crop-title" className="modal-title">{member} 사진 맞추기</h2>
        <p className="modal-desc">끌어서 옮기고, 아래 막대로 키웁니다. 얼굴이 동그라미에 꽉 차게 맞춰 주세요.</p>

        <div
          className="crop-view"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
          }}
          onPointerMove={move}
          onPointerUp={() => { drag.current = null }}
          onPointerCancel={() => { drag.current = null }}
        >
          <img
            src={img.src}
            alt=""
            draggable="false"
            style={{
              position: 'absolute',
              left: (VIEW - w) / 2 + off.x,
              top: (VIEW - h) / 2 + off.y,
              width: w,
              height: h,
              maxWidth: 'none',
            }}
          />
        </div>

        <label className="crop-zoom">
          <span>크기</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="사진 크기"
          />
        </label>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>취소</button>
          <button
            type="button"
            className="btn primary"
            onClick={() => onDone(cropToDataUrl(img, { view: VIEW, zoom, dx: off.x, dy: off.y }))}
          >
            이대로 쓰기
          </button>
        </div>
      </div>
    </div>
  )
}
