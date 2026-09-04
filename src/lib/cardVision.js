// OCR 결과를 스코어카드 구조에 맞춰 표로 되돌린다.
//
// 대상은 골프장 앱 캡처다. 구조가 정해져 있다.
//   상단   : 골프장 이름, 날짜·시간, 카드 주인의 총타수
//   요약   : 나머지 플레이어 총타수 (표가 아니다)
//   코스 띠 : "Sky-Lake" 처럼 전/후반 코스 이름
//   표     : HOLE(1~9, T) / PAR / 플레이어 4행  — 이 묶음이 전반·후반 두 번
//
// 칸의 숫자는 실제 타수가 아니라 파 대비 오버이고, T 열만 그 9홀의 그로스다.
// 후반 표도 홀 번호가 1~9 로 다시 시작하는 경우가 많아 홀 번호는 쓰지 않는다.

import { MEMBERS } from './handicap.js'

const cx = (w) => (w.x0 + w.x1) / 2
const cy = (w) => (w.y0 + w.y1) / 2
const width = (w) => w.x1 - w.x0
const height = (w) => w.y1 - w.y0

const median = (a) => {
  if (a.length === 0) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[Math.floor(s.length / 2)]
}

/** 비슷한 y 끼리 한 줄로 묶는다 */
export function groupRows(items, tolerance) {
  const rows = []
  for (const it of [...items].sort((a, b) => cy(a) - cy(b))) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(cy(it) - last.y) <= tolerance) {
      last.items.push(it)
      last.y = last.items.reduce((s, x) => s + cy(x), 0) / last.items.length
    } else {
      rows.push({ y: cy(it), items: [it] })
    }
  }
  for (const r of rows) r.items.sort((a, b) => cx(a) - cx(b))
  return rows
}

/**
 * 글자들을 칸 단위로 묶는다. 칸 사이 간격은 글자 사이 간격보다 훨씬 넓으므로
 * "글자 폭 × 1.3" 보다 벌어지면 다른 칸으로 본다. (36 → 한 칸, 3 | 6 → 두 칸)
 */
export function groupCells(symbols) {
  if (symbols.length === 0) return []
  const gapLimit = Math.max(4, median(symbols.map(width)) * 1.3)

  const cells = []
  let current = [symbols[0]]
  for (let i = 1; i < symbols.length; i++) {
    const gap = symbols[i].x0 - symbols[i - 1].x1
    if (gap > gapLimit) {
      cells.push(current)
      current = []
    }
    current.push(symbols[i])
  }
  cells.push(current)

  return cells.map((group) => ({
    text: group.map((g) => g.text).join(''),
    center: (group[0].x0 + group[group.length - 1].x1) / 2,
  }))
}

const PAR_LABEL = /^(par|pa|far|파)$/i
const HOLE_LABEL = /^(hole|hol|홀)$/i
const MASK = /[*○ㅇ〇OoXx×·・．.”“'"\s_-]/g

/** 스코어카드에서 사람 이름이 아닌 것들 */
const NOT_NAME = /^(합계|총계|전반|후반|코스|순위|스코어|스코어카드|타수|홀별|거리정보|보기|평균|핸디|네트|그로스|날짜|일자|par|hole)/i

export function looksLikeName(text) {
  const t = text.trim()
  if (!/[가-힣]/.test(t)) return false
  if (NOT_NAME.test(t)) return false
  const bare = t.replace(MASK, '')
  return bare.length >= 1 && bare.length <= 4
}

/** 가려진 이름을 멤버와 대조해 가능한 후보를 낸다 */
export function nameCandidates(label) {
  const chars = [...label.trim()]
  const bare = label.replace(MASK, '')

  const exact = MEMBERS.find((m) => m === bare)
  if (exact) return [exact]

  const masked = MEMBERS.filter(
    (m) => m.length === chars.length && [...m].every((c, i) => c === chars[i] || MASK.test(chars[i])),
  )
  if (masked.length > 0) return masked

  return bare ? MEMBERS.filter((m) => m[0] === bare[0]) : []
}

// ── 머리글 ───────────────────────────────────────────────

const DATE_RE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/
const TIME_RE = /\b([01]?\d|2[0-3])\s*[:시]\s*([0-5]\d)\b/
const COURSE_SUFFIX_RE = /[가-힣A-Za-z0-9]{2,18}\s?(?:CC|C\.C|GC|G\.C|컨트리클럽|골프클럽|골프장|리조트)/i
/** Sky-Lake 처럼 전/후반 코스를 한 줄에 적은 표기 */
const COURSE_PAIR_RE = /([A-Za-z가-힣]{2,12})\s*[-–~]\s*([A-Za-z가-힣]{2,12})/
const UI_LABEL = /^(스코어카드|스코어|홀별|거리정보|보기|공유|닫기|확인|취소|메뉴|더보기)/

export function readHeader(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const joined = lines.join('\n')

  const dateAt = lines.findIndex((l) => DATE_RE.test(l))
  const d = joined.match(DATE_RE)
  const date = d && +d[2] >= 1 && +d[2] <= 12 && +d[3] >= 1 && +d[3] <= 31
    ? `${d[1]}-${String(+d[2]).padStart(2, '0')}-${String(+d[3]).padStart(2, '0')}`
    : ''

  // 티오프는 날짜와 같은 줄에 붙어 나온다. 맨 윗줄 시계(휴대폰 상태바)를 잡지 않도록
  // 날짜 줄을 먼저 보고, 없을 때만 첫 줄을 뺀 나머지에서 찾는다.
  const fmtTime = (m) => `${String(+m[1]).padStart(2, '0')}:${m[2]}`
  let teeTime = ''
  const onDateLine = dateAt >= 0 ? lines[dateAt].match(TIME_RE) : null
  if (onDateLine) {
    teeTime = fmtTime(onDateLine)
  } else {
    for (const line of lines.slice(1)) {
      const m = line.match(TIME_RE)
      if (m) { teeTime = fmtTime(m); break }
    }
  }

  // 골프장 이름은 날짜 바로 윗줄에 있다. 다만 큰 총타수가 같은 줄 오른쪽에 붙어 있으므로
  // 넓은 공백에서 자르고 숫자를 걷어낸 뒤 앞부분만 쓴다. ("리앤리     104" → "리앤리")
  let course = ''
  for (let i = dateAt - 1; i >= 0 && i >= dateAt - 3; i--) {
    const head = lines[i].split(/\s{2,}/)[0]
    const cleaned = head.replace(/[^가-힣A-Za-z0-9 .&]/g, ' ').replace(/\d+/g, ' ').replace(/\s{2,}/g, ' ').trim()
    if (cleaned.length < 2 || cleaned.length > 20) continue
    if (UI_LABEL.test(cleaned)) continue
    course = cleaned
    break
  }
  if (!course) course = joined.match(COURSE_SUFFIX_RE)?.[0].trim() || ''

  // 코스 이름 띠에서 "Sky-Lake" 같은 전/후반 표기를 찾는다
  let courseFront = ''
  let courseBack = ''
  for (const line of lines) {
    if (DATE_RE.test(line) || UI_LABEL.test(line)) continue
    const m = line.replace(/[^A-Za-z가-힣\-–~ ]/g, ' ').match(COURSE_PAIR_RE)
    if (m && m[1] !== m[2]) {
      courseFront = m[1]
      courseBack = m[2]
      break
    }
  }

  return { date, teeTime, course, courseFront, courseBack }
}

// ── 표 복원 ──────────────────────────────────────────────

/**
 * PAR 행을 기준선으로 삼아 전반·후반 블록을 잡고, 각 행의 칸 값을 읽는다.
 * 숫자는 글자 단위 좌표(symbols)로 다루어야 붙어 있는 칸이 뭉개지지 않는다.
 */
/**
 * 이름 칸에서 새어 나온 숫자는 다른 열들과 간격이 유난히 벌어진다.
 * 열 간격의 중앙값보다 1.8배 넘게 떨어진 앞쪽 칸은 표 밖으로 본다.
 */
function trimLeadingOutliers(cells) {
  while (cells.length > 10) {
    const gaps = []
    for (let i = 1; i < cells.length; i++) gaps.push(cells[i].center - cells[i - 1].center)
    const pitch = median(gaps.slice(-9))
    if (pitch > 0 && gaps[0] > pitch * 1.8) cells = cells.slice(1)
    else break
  }
  return cells
}

/** 9홀 값이 모두 3~6 이면 PAR 행으로 본다 (PAR 글자를 못 읽어도 찾아내기 위해) */
function looksLikeParRow(cells) {
  if (cells.length < 9) return false
  const nine = cells.slice(0, 9).map((c) => Number(c.text))
  if (nine.some((v) => !Number.isFinite(v) || v < 3 || v > 6)) return false
  const sum = nine.reduce((a, b) => a + b, 0)
  return sum >= 27 && sum <= 45
}

/**
 * 표를 복원한다.
 *
 * 글자(PAR, 이름)에 기대지 않고 숫자 격자로 먼저 표를 찾는다.
 * 실제 카드에서는 PAR 이 PAB 로, 최** 가 알아볼 수 없는 글자로 읽히는 일이 잦아서,
 * 글자를 기준으로 삼으면 표 전체를 놓친다. 글자는 행에 이름표를 붙이는 데만 쓴다.
 */
export function buildTable({ textWords, digitSymbols }) {
  const lineHeight = median(textWords.map(height).filter((h) => h > 0)) ||
    median(digitSymbols.map(height).filter((h) => h > 0)) || 14
  const rowTol = lineHeight * 0.6

  const textRows = groupRows(textWords, rowTol)
  const digitRows = groupRows(digitSymbols, rowTol)

  // 숫자가 여러 칸 늘어선 줄만 표의 후보다
  const gridRows = digitRows
    .map((r) => ({ y: r.y, cells: trimLeadingOutliers(groupCells(r.items)) }))
    .filter((r) => r.cells.length >= 8)

  const parLabelAt = (y) =>
    textRows.some((r) => Math.abs(r.y - y) <= rowTol && r.items.some((w) => PAR_LABEL.test(w.text)))

  // PAR 행은 글자로 찾는 게 가장 정확하다.
  // 값만 보고 판정하면 플레이어 행이 우연히 전부 3~6 일 때 PAR 로 오인한다.
  // 그래서 PAR 글자를 하나도 못 읽었을 때만 값으로 추정한다.
  const labelled = gridRows.map((r, i) => ({ r, i })).filter(({ r }) => parLabelAt(r.y)).map(({ i }) => i)
  const guessed = gridRows.map((r, i) => ({ r, i })).filter(({ r }) => looksLikeParRow(r.cells)).map(({ i }) => i)
  const parIndexes = labelled.length > 0 ? labelled : guessed

  const diag = {
    textWords: textWords.length,
    digitSymbols: digitSymbols.length,
    textRows: textRows.length,
    gridRows: gridRows.length,
    parRows: parIndexes.length,
    nameRows: textRows.filter((r) => r.items.some((w) => looksLikeName(w.text))).length,
    lineHeight: Math.round(lineHeight),
  }

  if (parIndexes.length === 0) return { blocks: [], lineHeight, diag }

  const labelFor = (y, firstColumn) => {
    const row = textRows.find((r) => Math.abs(r.y - y) <= rowTol * 1.4)
    if (!row) return ''
    const left = row.items.filter((w) => w.x1 < firstColumn)
    const named = left.find((w) => looksLikeName(w.text))
    return (named || left[0])?.text ?? ''
  }

  const blocks = []

  for (let b = 0; b < parIndexes.length; b++) {
    const parAt = parIndexes[b]
    const nextParAt = b + 1 < parIndexes.length ? parIndexes[b + 1] : gridRows.length

    const parRow = gridRows[parAt]
    const columns = parRow.cells.map((c) => c.center)
    const firstColumn = columns[0] - (columns[1] - columns[0]) / 2

    const toCells = (cells) => {
      const out = Array(columns.length).fill(null)
      for (const cell of cells) {
        let best = 0
        let bestGap = Infinity
        columns.forEach((c, i) => {
          const gap = Math.abs(c - cell.center)
          if (gap < bestGap) { bestGap = gap; best = i }
        })
        const v = Number(cell.text)
        if (out[best] === null && Number.isFinite(v)) out[best] = v
      }
      return out
    }

    const rows = []
    for (let i = parAt + 1; i < nextParAt && rows.length < MEMBERS.length; i++) {
      const row = gridRows[i]
      rows.push({ label: labelFor(row.y, firstColumn), cells: toCells(row.cells) })
    }

    // 코스 이름 띠: 표 바로 위, 숫자 없이 짧게 적힌 줄 (Sky / Lake 처럼 나인마다 적는 카드용)
    const prevY = b === 0 ? -Infinity : gridRows[parIndexes[b - 1]].y
    const banner = textRows
      .filter((r) => r.y < parRow.y - rowTol && r.y > prevY + rowTol)
      .filter((r) => {
        if (r.items.some((w) => looksLikeName(w.text) || HOLE_LABEL.test(w.text) || PAR_LABEL.test(w.text))) return false
        if (digitSymbols.some((d) => Math.abs(cy(d) - r.y) <= rowTol)) return false
        const joined = r.items.map((w) => w.text).join(' ').replace(/[^A-Za-z가-힣0-9 .&-]/g, ' ').trim()
        return /^[A-Za-z가-힣][A-Za-z가-힣0-9 .&-]{1,22}$/.test(joined)
      })
      .pop()

    blocks.push({
      columns,
      courseName: banner
        ? banner.items.map((w) => w.text).join(' ').replace(/[^A-Za-z가-힣0-9 .&-]/g, ' ').replace(/\s{2,}/g, ' ').trim()
        : '',
      pars: parRow.cells.map((c) => Number(c.text)),
      rows,
    })
  }

  diag.playerRows = blocks.reduce((n, x) => n + x.rows.length, 0)
  return { blocks, lineHeight, diag }
}

/** 열이 10개면 마지막이 T, 모자라면 T 를 못 읽은 것으로 본다 */
export function normalizeBlock(block) {
  const take = (cells) => {
    const clean = cells.map((v) => (Number.isFinite(v) ? v : null))
    if (clean.length >= 10) return { nine: clean.slice(0, 9), total: clean[clean.length - 1] }
    return { nine: [...clean, ...Array(9).fill(null)].slice(0, 9), total: null }
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
