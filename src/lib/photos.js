// 멤버 사진 저장 — localStorage 하나에 240px 정사각 JPEG 로 담는다.
// 원본을 그대로 넣으면 localStorage 5MB 를 금방 넘긴다.

const KEY = 'nakwon.photos'
const SIZE = 240

/** { 손유권: 'data:image/jpeg;base64,...' } */
export function loadPhotos() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

export function savePhotos(photos) {
  try {
    localStorage.setItem(KEY, JSON.stringify(photos))
  } catch (e) {
    // 용량 초과 — 사진 한 장이 너무 크거나 네 장을 넘겼을 때
    console.warn('사진 저장 실패', e)
    throw new Error('사진을 저장할 공간이 부족합니다. 한 장을 지우고 다시 시도해 주세요.')
  }
}

export function setPhoto(member, dataUrl) {
  const next = { ...loadPhotos(), [member]: dataUrl }
  savePhotos(next)
  return next
}

export function removePhoto(member) {
  const next = { ...loadPhotos() }
  delete next[member]
  savePhotos(next)
  return next
}

/**
 * 파일을 240px 정사각으로 잘라 JPEG data URL 로. 가운데를 기준으로 자른다 —
 * 얼굴은 대개 가운데에 있고, 원형 마스크가 다시 한 번 가장자리를 깎는다.
 */
export function fileToSquareDataUrl(file, size = SIZE) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.width, img.height)
      const sx = (img.width - side) / 2
      const sy = (img.height - side) / 2

      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽지 못했습니다.'))
    }
    img.src = url
  })
}
