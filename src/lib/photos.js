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

/** 파일을 <img> 로 읽는다. 자르기 전에 크기를 알아야 미리보기를 그릴 수 있다 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다.')) }
    img.src = url
  })
}

/**
 * 사람이 맞춘 자리 그대로 240px 정사각 JPEG 로 굽는다.
 *
 * ══════════════════════════════════════════════════════════════════
 * **가운데를 기계적으로 자르지 않는다.**
 *
 * 여태 짧은 변 기준으로 한가운데를 잘랐다. 그런데 사진마다 얼굴이 있는 자리가
 * 다르다 — 서서 찍은 사진은 얼굴이 위쪽에, 멀리서 찍은 사진은 얼굴이 작게
 * 박힌다. 그러면 동그라미 안이 배경으로 절반쯤 차고 얼굴은 콩알만 해진다.
 *
 * 미리보기에서 끌고 늘려 맞춘 그 상태를 그대로 굽는다. 미리보기와 결과가
 * 같은 셈을 쓰므로(아래 fit), 보이는 대로 저장된다.
 * ══════════════════════════════════════════════════════════════════
 *
 *   view  미리보기 동그라미의 지름(px)
 *   zoom  1 = 동그라미를 꽉 채우는 최소 크기. 키우면 확대된다
 *   dx dy 미리보기 안에서 끌어 옮긴 거리(px)
 */
export function cropToDataUrl(img, { view, zoom = 1, dx = 0, dy = 0 }, size = SIZE) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  /* 미리보기에서 쓰던 셈을 결과 크기로 그대로 옮긴다 */
  const k = size / view
  const base = view / Math.min(img.width, img.height)   // 꽉 채우는 최소 배율
  const scale = base * zoom * k
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (size - w) / 2 + dx * k, (size - h) / 2 + dy * k, w, h)

  return canvas.toDataURL('image/jpeg', 0.82)
}

/** 끌어 옮길 수 있는 최대 거리 — 동그라미 밖으로 빈 자리가 보이지 않게 */
export function cropBounds(img, view, zoom) {
  const base = view / Math.min(img.width, img.height)
  const scale = base * zoom
  return {
    x: Math.max(0, (img.width * scale - view) / 2),
    y: Math.max(0, (img.height * scale - view) / 2),
  }
}
