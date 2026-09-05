// 스코어카드 사진을 서버(/api/ocr)로 보내 홀별 기록을 받아 온다.
// 판독은 Claude 가 하고, API 키는 서버에만 있다.

const MAX_SIDE = 1568 // 이보다 크게 보내도 판독 쪽에서 줄이므로 의미가 없다
const QUALITY = 0.85

class ApiUnavailable extends Error {}
export { ApiUnavailable }

async function loadImage(file) {
  // 휴대폰 사진에는 회전 정보(EXIF)가 붙는다. from-image 를 주지 않으면 눕혀진 채로 들어와
  // 표를 못 읽는다. <img> 경로는 브라우저가 알아서 회전해 준다.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    /* 이 옵션을 모르는 브라우저이거나, HEIC 처럼 못 여는 형식 */
  }
  try {
    return await createImageBitmap(file)
  } catch {
    /* <img> 로 다시 시도한다 */
  }

  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.decoding = 'sync'
      img.onload = () => resolve(img)
      img.onerror = () =>
        reject(new Error(
          '이 사진을 열 수 없습니다. 아이폰이라면 설정 > 카메라 > 포맷을 "높은 호환성"으로 바꾸거나, ' +
          '사진을 캡처(스크린샷)해서 올려 주세요.',
        ))
      img.src = url
    })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}

/** 긴 쪽을 1568px 로 줄이고 JPEG 로 압축해 보낼 준비를 한다 */
export async function toUpload(file) {
  const image = await loadImage(file)
  const w = image.width || image.naturalWidth
  const h = image.height || image.naturalHeight
  if (!w || !h) throw new Error('이미지 크기를 읽을 수 없습니다')

  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close?.()

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  return {
    image: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mediaType: 'image/jpeg',
    size: `${canvas.width}×${canvas.height}`,
  }
}

export async function readScorecard(file) {
  const { image, mediaType, size } = await toUpload(file)

  let response
  try {
    response = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mediaType }),
    })
  } catch {
    throw new ApiUnavailable('판독 서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.')
  }

  // 정적 호스팅(미리보기·GitHub Pages)에는 /api 가 없어서 HTML 이 돌아온다
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new ApiUnavailable('이 주소에서는 사진 인식을 쓸 수 없습니다. 판독 서버가 있는 주소에서 열어 주세요.')
  }

  const body = await response.json()
  if (!response.ok) throw new Error(body?.error || `판독에 실패했습니다 (${response.status})`)

  return { ...body.result, uploadSize: size }
}
