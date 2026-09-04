// tesseract.js 래퍼. 워커는 한 번 만들어 두고 재사용한다.

let workerPromise = null

/**
 * 인식 모델(한국어)은 처음 한 번만 내려받고 이후에는 브라우저 캐시에서 읽는다.
 * onProgress(0~1, 상태문구) 로 진행률을 알려준다.
 */
async function getWorker(onProgress) {
  if (!workerPromise) {
    const { createWorker } = await import('tesseract.js')
    workerPromise = createWorker(['kor', 'eng'], 1, {
      logger: (m) => {
        if (m.status === 'loading tesseract core') onProgress?.(m.progress * 0.15, '인식 엔진 준비 중')
        else if (m.status.startsWith('loading language')) onProgress?.(0.15 + m.progress * 0.4, '한글 인식 모델 내려받는 중')
        else if (m.status === 'initializing api') onProgress?.(0.55, '준비 중')
      },
    }).catch((e) => {
      workerPromise = null
      throw e
    })
  }
  return workerPromise
}

export async function recognize(image, onProgress) {
  const worker = await getWorker(onProgress)
  const { data } = await worker.recognize(image)
  return data.text || ''
}

/**
 * 골프 앱 스코어카드는 날짜·골프장이 상단 머리글에 작고 옅게(주로 진한 배경 위 흰 글씨) 박혀 있어
 * 전체 이미지를 한 번에 읽으면 통째로 누락된다.
 * 머리글 띠만 잘라 확대하고, 배경이 어두우면 흑백을 뒤집어 대비를 올린 뒤 다시 읽는다.
 */
export async function headerStrip(file, { fraction = 0.3, scale = 3 } = {}) {
  const bitmap = await createImageBitmap(file)
  const stripHeight = Math.max(1, Math.round(bitmap.height * fraction))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(stripHeight * scale)

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, bitmap.width, stripHeight, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = frame.data

  let sum = 0
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = gray
    sum += gray
  }

  // 배경이 어두우면(= 글씨가 밝으면) 뒤집어서 어두운 글씨/밝은 배경으로 만든다
  const mean = sum / (d.length / 4)
  const flip = mean < 128

  for (let i = 0; i < d.length; i += 4) {
    const g = flip ? 255 - d[i] : d[i]
    // 중간 대비를 넓혀 옅은 글씨를 살린다
    const boosted = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128))
    d[i] = d[i + 1] = d[i + 2] = boosted
  }

  ctx.putImageData(frame, 0, 0)
  return canvas
}
