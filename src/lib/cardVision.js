// OCR 단어 좌표를 스코어카드 구조에 맞춰 표로 되돌린다.
//
// 이 앱이 읽는 카드는 골프장 앱 캡처라 구조가 정해져 있다.
//   상단   : 골프장 이름, 날짜, (티오프 시간)
//   블록   : 코스 이름 헤더 → HOLE 행(1~9, T) → PAR 행 → 플레이어 4행
//   블록이 전반/후반 두 번 반복된다.
// 표 안의 숫자는 실제 타수가 아니라 파 대비 오버 타수이고, T 열만 그로스 총 타수다.

import { MEMBERS } from './handicap.js'

const cx = (w) => (w.x0 + w.x1) / 2
const cy = (w) => (w.y0 + w.y1) / 2
const wordHeight = (w) => w.y1 - w.y0

const median = (a) => {
  if (a.length === 0) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

/** 비슷한 y 끼리 한 줄로 묶는다 */
export function groupRows(words, tolerance) {
  const rows = []
  for (const w of [...words].sort((a, b) => cy(a) - cy(b))) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(cy(w) - last.y) <= tolerance) {
      last.words.push(w)
      last.y = last.words.reduce((s, x) => s + cy(x), 0) / last.words.length
    } else {
      rows.push({ y: cy(w), words: [w] })
    }
  }
  for (const r of rows) r.words.sort((a, b) => cx(a) - cx(b))
  return rows
}

/** 1차원 좌표를 큰 간격에서 끊어 열로 나눈다 */
export function clusterColumns(xs, minGap) {
  const sorted = [...xs].sort((a, b) => a - b)
  const groups = []
  for (const x of sorted) {
    const last = groups[groups.length - 1]
    if (last && x - last[last.length - 1] <= minGap) last.push(x)
    else groups.push([x])
  }
  return groups.map((g) => g.reduce((s, v) => s + v, 0) / g.length)
}

const PAR_LABEL = /^(par|pa|far|과|파)$/i
const HOLE_LABEL = /^(hole|hol|홀)$/i
const MASK = /[*○ㅇ〇OoXx×·・．.\s_-]/g

/** 이름처럼 보이는 토큰인지 (마스킹된 이름 포함) */
export function looksLikeName(text) {
  const t = text.trim()
  if (!/[가-힣]/.test(t)) return false
  if (PAR_LABEL.test(t) || HOLE_LABEL.test(t)) return false
  if (/^(합계|총계|전반|후반|코스|순위|스코어|타수)/.test(t)) return false
  const bare = t.replace(MASK, '')
  return bare.length >= 1 && bare.length <= 4
}

/** 마스킹된 이름을 멤버와 대조해 후보를 낸다 */
export function nameCandidates(label) {
  const chars = [...label.trim()]
  const bare = label.replace(MASK, '')

  const exact = MEMBERS.find((m) => m === bare)
  if (exact) return [exact]

  // 최*규 처럼 자리수가 같고 가려지지 않은 글자가 전부 맞는 경우
  const masked = MEMBERS.filter(
    (m) => m.length === chars.length && [...m].every((c, i) => c === chars[i] || MASK.test(chars[i])),
  )
  if (masked.length > 0) return masked

  // 성만 나온 경우
  const bySurname = MEMBERS.filter((m) => m[0] === bare[0])
  return bySurname.length > 0 ? bySurname : []
}

const DATE_RE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/
const TIME_RE = /\b([01]?\d|2[0-3])\s*[:시]\s*([0-5]\d)\b/
const COURSE_RE = /[가-힣A-Za-z0-9]{2,18}\s?(?:CC|C\.C|GC|G\.C|컨트리클럽|골프클럽|골프장|리조트)/i
/** Sky-Lake, Valley-Hill 처럼 코스 이름으로 쓰이는 표기 */
const COURSE_PAIR_RE = /\b([A-Za-z가-힣]{2,10})\s*[-–~]\s*([A-Za-z가-힣]{2,10})\b/

export function readHeader(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const joined = lines.join('\n')

  const d = joined.match(DATE_RE)
  const date = d && +d[2] >= 1 && +d[2] <= 12 && +d[3] >= 1 && +d[3] <= 31
    ? `${d[1]}-${String(+d[2]).padStart(2, '0')}-${String(+d[3]).padStart(2, '0')}`
    : ''

  const t = joined.match(TIME_RE)
  const teeTime = t ? `${String(+t[1]).padStart(2, '0')}:${t[2]}` : ''

  let course = ''
  for (const line of lines) {
    const m = line.match(COURSE_RE)
    if (m) { course = m[0].trim(); break }
  }
  if (!course) {
    const head = lines.find((l) => /^[가-힣]{3,}/.test(l) && !DATE_RE.test(l))
    if (head) course = head.match(/^[가-힣][가-힣\s]{2,20}/)?.[0].trim() || ''
  }

  const pair = joined.match(COURSE_PAIR_RE)
  return {
    date,
    teeTime,
    course,
    courseFront: pair ? pair[1] : '',
    courseBack: pair ? pair[2] : '',
  }
}

/**
 * 표를 복원한다.
 * textWords 로 PAR 행과 이름 행의 위치를 잡고, 숫자는 digitWords 에서 가져온다.
 */
export function buildTable({ textWords, digitWords }) {
  const heights = textWords.map(wordHeight).filter((h) => h > 0)
  const lineHeight = median(heights) || 14
  const rowTol = lineHeight * 0.6

  const textRows = groupRows(textWords, rowTol)

  // PAR 행이 곧 블록의 기준선이다. 보통 전반/후반 두 개가 나온다.
  const parRows = textRows.filter((r) => r.words.some((w) => PAR_LABEL.test(w.text)))
  if (parRows.length === 0) return { blocks: [], lineHeight }

  const digitRows = groupRows(digitWords, rowTol)
  const nearestDigits = (y) => {
    let best = null
    let bestGap = Infinity
    for (const r of digitRows) {
      const gap = Math.abs(r.y - y)
      if (gap < bestGap) { bestGap = gap; best = r }
    }
    return bestGap <= lineHeight * 1.1 ? best : null
  }

  const blocks = []

  for (let b = 0; b < parRows.length; b++) {
    const parRow = parRows[b]
    const nextParY = b + 1 < parRows.length ? parRows[b + 1].y : Infinity

    // 이 블록에 속한 이름 행: PAR 아래, 다음 PAR 위
    const nameRows = textRows.filter(
      (r) => r.y > parRow.y + rowTol && r.y < nextParY - rowTol && r.words.some((w) => looksLikeName(w.text)),
    )

    const parDigits = nearestDigits(parRow.y)
    if (!parDigits) continue

    const memberRows = nameRows
      .map((r) => {
        const label = r.words.find((w) => looksLikeName(w.text))?.text ?? ''
        return { label, y: r.y, digits: nearestDigits(r.y) }
      })
      .filter((r) => r.digits)

    // 맨 왼쪽 이름 칸(PAR / 손유권 / 최**)은 숫자 인식에서 0 이나 1 로 잘못 읽히기 쉽다.
    // 그 오른쪽 끝을 경계로 삼아 이름에서 나온 가짜 숫자를 걷어낸다.
    const labelWords = [
      ...parRow.words.filter((w) => PAR_LABEL.test(w.text)),
      ...nameRows.flatMap((r) => r.words.filter((w) => looksLikeName(w.text))),
    ]
    const headerRight = labelWords.length ? Math.max(...labelWords.map((w) => w.x1)) : -Infinity
    const inTable = (w) => cx(w) > headerRight

    parDigits.words = parDigits.words.filter(inTable)
    for (const r of memberRows) r.digits = { ...r.digits, words: r.digits.words.filter(inTable) }

    // 열 위치는 이 블록의 모든 숫자 x 를 모아 큰 간격에서 끊어 만든다
    const allX = [parDigits, ...memberRows.map((r) => r.digits)].flatMap((r) => r.words.map(cx))
    if (allX.length === 0) continue
    const gaps = []
    const sortedX = [...allX].sort((a, b2) => a - b2)
    for (let i = 1; i < sortedX.length; i++) gaps.push(sortedX[i] - sortedX[i - 1])
    const minGap = Math.max(lineHeight * 0.8, median(gaps.filter((g) => g > 0)) * 2)
    const columns = clusterColumns(allX, minGap)

    const toCells = (row) => {
      const cells = Array(columns.length).fill(null)
      for (const w of row.words) {
        const v = Number(w.text)
        if (!Number.isFinite(v)) continue
        let best = 0
        let bestGap = Infinity
        columns.forEach((c, i) => {
          const gap = Math.abs(c - cx(w))
          if (gap < bestGap) { bestGap = gap; best = i }
        })
        if (cells[best] === null) cells[best] = v
      }
      return cells
    }

    // 코스 이름(Sky, Lake)은 표 바로 위 띠에 짧게 적혀 있다
    const prevBlockY = b === 0 ? -Infinity : parRows[b - 1].y
    const banner = textRows
      .filter((r) => r.y < parRow.y - rowTol && r.y > prevBlockY + rowTol)
      .filter((r) => {
        const joined = r.words.map((w) => w.text).join(' ').trim()
        if (!joined || joined.length > 24) return false
        if (HOLE_LABEL.test(r.words[0]?.text) || PAR_LABEL.test(r.words[0]?.text)) return false
        return /^[A-Za-z가-힣][A-Za-z가-힣0-9 .&-]{1,20}$/.test(joined) && !DATE_RE.test(joined)
      })
      .pop()

    blocks.push({
      columns,
      courseName: banner ? banner.words.map((w) => w.text).join(' ').trim() : '',
      pars: toCells(parDigits),
      rows: memberRows.map((r) => ({ label: r.label, cells: toCells(r.digits) })),
    })
  }

  return { blocks, lineHeight }
}

/**
 * 복원한 블록을 9홀 + T 형태로 정리한다.
 * 열이 10개면 마지막이 T, 9개면 T 가 안 읽힌 것으로 본다.
 */
export function normalizeBlock(block) {
  const take = (cells) => {
    if (cells.length >= 10) return { nine: cells.slice(0, 9), total: cells[cells.length - 1] }
    return { nine: [...cells, ...Array(9).fill(null)].slice(0, 9), total: null }
  }

  const par = take(block.pars)
  return {
    courseName: block.courseName || '',
    pars: par.nine,
    parTotal: par.total,
    rows: block.rows.map((r) => {
      const t = take(r.cells)
      return { label: r.label, overs: t.nine, total: t.total }
    }),
  }
}
