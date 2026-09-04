// tesseract.js 래퍼.
//
// 두 종류의 워커를 쓴다.
//  - text  : 한글+영문. 골프장/코스/날짜와 플레이어 이름 줄을 읽는다.
//  - digits: 영문 + 숫자만 허용. 표 안의 숫자는 이쪽이 훨씬 정확하다.

const workers = { text: null, digits: null, digitsBlock: null }

const LANGS = { text: ['kor', 'eng'], digits: ['eng'], digitsBlock: ['eng'] }

// 6  = 균일한 블록 하나로 본다 (깔끔한 표에 잘 맞는다)
// 11 = 흩어진 글자를 위치 상관없이 최대한 많이 찾는다.
//      상태바·제목·요약카드·버튼이 섞인 실제 앱 캡처에서는 이쪽이 훨씬 안전하다.
//      우리는 격자를 직접 재구성하므로 레이아웃 분석이 필요 없다.
const PSM = { digits: '11', digitsBlock: '6' }

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
        if (PSM[kind]) {
          await worker.setParameters({
            tessedit_char_whitelist: '0123456789-',
            tessedit_pageseg_mode: PSM[kind],
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

  const box = (b) => ({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1 })

  const words = (data.words || [])
    .filter((w) => w.text && w.text.trim())
    .map((w) => ({ text: w.text.trim(), confidence: w.confidence ?? 0, ...box(w.bbox) }))

  // 표의 칸을 좌표로 맞추려면 단어가 아니라 글자 단위가 필요하다.
  // 붙어 있는 칸을 한 단어로 묶어 읽는 경우가 잦기 때문이다.
  const symbols = (data.symbols || [])
    .filter((sym) => sym.text && sym.text.trim())
    .map((sym) => ({ text: sym.text.trim(), confidence: sym.confidence ?? 0, ...box(sym.bbox) }))

  return { text: data.text || '', words, symbols }
}

export async function disposeOcr() {
  for (const kind of Object.keys(workers)) {
    const pending = workers[kind]
    workers[kind] = null
    const worker = await pending?.catch(() => null)
    await worker?.terminate()
  }
}
