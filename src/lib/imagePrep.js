// OCR 전처리. 골프 앱 캡처는 글자가 작고 배경색이 있어서 그대로 넣으면 잘 안 읽힌다.

/** 캔버스를 그레이스케일로 바꾸고, 밝기 분포를 양끝까지 늘려 대비를 세운다. */
function stretchContrast(ctx, width, height) {
  const frame = ctx.getImageData(0, 0, width, height)
  const d = frame.data
  const histogram = new Uint32Array(256)

  for (let i = 0; i < d.length; i += 4) {
    const gray = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0
    d[i] = d[i + 1] = d[i + 2] = gray
    histogram[gray]++
  }

  // 위아래 2% 를 잘라내고 그 사이를 0~255 로 편다 (극단값에 휘둘리지 않게)
  const total = d.length / 4
  const cut = total * 0.02
  let low = 0
  let high = 255
  for (let acc = 0, v = 0; v < 256; v++) { acc += histogram[v]; if (acc > cut) { low = v; break } }
  for (let acc = 0, v = 255; v >= 0; v--) { acc += histogram[v]; if (acc > cut) { high = v; break } }

  const span = Math.max(1, high - low)
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - low) / span) * 255))
    d[i] = d[i + 1] = d[i + 2] = v
  }

  ctx.putImageData(frame, 0, 0)
}

/**
 * 파일을 캔버스에 그릴 수 있는 형태로 연다.
 * createImageBitmap 이 못 여는 형식(사파리의 HEIC 등)은 <img> 로 한 번 더 시도한다.
 */
async function loadImage(file) {
  try {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('이 형식의 이미지는 열 수 없습니다 (JPG 또는 PNG로 저장해 주세요)'))
        el.src = url
      })
      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      }
    } catch (e) {
      URL.revokeObjectURL(url)
      throw e
    }
  }
}

/** 배경이 어두우면(= 글씨가 밝으면) 뒤집어 어두운 글씨/밝은 배경으로 만든다 */
function invertIfDark(ctx, width, height) {
  const frame = ctx.getImageData(0, 0, width, height)
  const d = frame.data

  let sum = 0
  for (let i = 0; i < d.length; i += 4) sum += d[i]
  if (sum / (d.length / 4) >= 128) return

  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = 255 - d[i]
  }
  ctx.putImageData(frame, 0, 0)
}

/**
 * 이미지를 확대 + 그레이스케일 + 대비 보정해서 돌려준다.
 * fraction 을 주면 위에서부터 그 비율만큼만 잘라낸다 (머리글만 읽을 때).
 */
/**
 * 휴대폰 캡처는 이미 해상도가 높아서 더 키울 필요가 없다.
 * 오히려 크게 만들면 아이폰 사파리에서 메모리 한계에 걸려 인식이 통째로 망가진다.
 * 글자 높이가 인식에 충분할 만큼만 맞추고, 전체 픽셀 수에도 상한을 둔다.
 */
function pickScale(width, height, { scale, target, maxScale, maxPixels }) {
  let factor = scale ?? Math.min(maxScale, Math.max(1, target / width))
  const pixels = width * factor * height * factor
  if (pixels > maxPixels) factor *= Math.sqrt(maxPixels / pixels)
  return Math.max(0.5, factor)
}

export async function prepare(
  file,
  { top = 0, bottom = 1, autoInvert = false, scale, target = 1600, maxScale = 3, maxPixels = 6e6 } = {},
) {
  const image = await loadImage(file)
  if (!image.width || !image.height) {
    image.close()
    throw new Error('이미지 크기를 읽을 수 없습니다')
  }

  const sy = Math.round(image.height * top)
  const sh = Math.max(1, Math.round(image.height * bottom) - sy)
  const factor = pickScale(image.width, sh, { scale, target, maxScale, maxPixels })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * factor))
  canvas.height = Math.max(1, Math.round(sh * factor))

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image.source, 0, sy, image.width, sh, 0, 0, canvas.width, canvas.height)
  image.close()

  stretchContrast(ctx, canvas.width, canvas.height)
  if (autoInvert) invertIfDark(ctx, canvas.width, canvas.height)

  return { canvas, scale: factor, offsetY: sy * factor, source: { width: image.width, height: image.height } }
}
