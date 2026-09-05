import { useRef, useState } from 'react'
import { MEMBERS } from '../lib/handicap.js'
import { fileToSquareDataUrl, loadPhotos, removePhoto, setPhoto } from '../lib/photos.js'
import MemberAvatar from './MemberAvatar.jsx'

/**
 * 멤버 사진 등록. 홈 화면 맨 아래나 설정 자리에 한 번 두면 된다.
 * 누르면 파일 선택 → 240px 정사각으로 줄여 localStorage 에 저장.
 */
export default function PhotoPicker({ onChange }) {
  const [photos, setPhotos] = useState(loadPhotos)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const inputs = useRef({})

  const pick = async (member, file) => {
    if (!file) return
    setBusy(member)
    setError('')
    try {
      const dataUrl = await fileToSquareDataUrl(file)
      const next = setPhoto(member, dataUrl)
      setPhotos(next)
      onChange?.(next)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const clear = (member) => {
    const next = removePhoto(member)
    setPhotos(next)
    onChange?.(next)
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <strong style={{ font: '700 14px Pretendard, sans-serif', color: 'var(--ink)' }}>멤버 사진</strong>
        <span className="hint">순위 화면에 얼굴로 나옵니다</span>
      </div>

      {error && <div className="notice error" role="alert">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {MEMBERS.map((m) => (
          <div key={m} style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => inputs.current[m]?.click()}
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', opacity: busy === m ? 0.5 : 1 }}
              aria-label={`${m} 사진 등록`}
            >
              <MemberAvatar member={m} src={photos[m]} size={56} />
            </button>
            <div style={{ font: '600 11px Pretendard, sans-serif', color: 'var(--ink)', marginTop: 6 }}>{m}</div>
            {photos[m] ? (
              <button
                type="button"
                onClick={() => clear(m)}
                style={{ background: 'none', border: 0, padding: '2px 0', cursor: 'pointer', font: '500 10px Pretendard, sans-serif', color: 'var(--ink-3)' }}
              >
                지우기
              </button>
            ) : (
              <div style={{ font: '500 10px Pretendard, sans-serif', color: 'var(--ink-3)', padding: '2px 0' }}>없음</div>
            )}
            <input
              ref={(el) => { inputs.current[m] = el }}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(m, f) }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
