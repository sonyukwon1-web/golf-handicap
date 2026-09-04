// tesseract.js 래퍼.
//
// 두 종류의 워커를 쓴다.
//  - text  : 한글+영문. 골프장/코스/날짜와 플레이어 이름 줄을 읽는다.
//  - digits: 영문 + 숫자만 허용. 표 안의 숫자는 이쪽이 훨씬 정확하다.

const workers = { text: null, digits: null }

const LANGS = { text: ['kor', 'eng'], digits: ['eng'] }

async function getWorker(kind, onProgress) {
  if (!workers[kind]) {
    const { createWorker } = await import('tesseract.js')

    workers[kind] = createWorker(LANGS[kind], 1, {
      logger: (m) => {
        if (m.status === 'loading tesseract core') onProgress?.(m.progress * 0.15, '인식 엔진 준비 중')
        else if (m.status.startsWith('loading language')) onProgress?.(0.15 + m.progress * 0.35, '인식 모델 내려받는 중')
        else if (m.status === 'initializing api') onProgress?.(0.5, '준비 중')
      },
    })
      .then(async (worker) => {
        if (kind === 'digits') {
          await worker.setParameters({
            tessedit_char_whitelist: '0123456789-',
            tessedit_pageseg_mode: '6', // 균일한 텍스트 블록 = 표
          })
        }
        return worker
      })
      .catch((e) => {
        workers[kind] = null
        throw e
      })
  }
  return workers[kind]
}

/** 단어별 위치까지 함께 돌려준다. 표 구조를 잡으려면 좌표가 필요하다. */
export async function recognizeWords(image, kind, onProgress) {
  const worker = await getWorker(kind, onProgress)
  const { data } = await worker.recognize(image)

  const words = (data.words || [])
    .filter((w) => w.text && w.text.trim())
    .map((w) => ({
      text: w.text.trim(),
      confidence: w.confidence ?? 0,
      x0: w.bbox.x0, x1: w.bbox.x1, y0: w.bbox.y0, y1: w.bbox.y1,
    }))

  return { text: data.text || '', words }
}

export async function disposeOcr() {
  for (const kind of Object.keys(workers)) {
    const pending = workers[kind]
    workers[kind] = null
    const worker = await pending?.catch(() => null)
    await worker?.terminate()
  }
}
