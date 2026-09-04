// 스코어카드 OCR 텍스트 → 라운드 초안으로 바꾸는 파싱/이름 매칭 로직 (순수 함수)

import { MEMBERS } from './handicap.js'

/** 성 → 그 성을 쓰는 멤버들. 최진규·최문창처럼 성이 겹치면 배열이 2개 이상이 된다. */
export const BY_SURNAME = MEMBERS.reduce((acc, m) => {
  ;(acc[m[0]] ||= []).push(m)
  return acc
}, {})

/** 이름 가리기에 쓰이는 문자들 (최*규, 최○○, 최XX …) */
const MASK_CHARS = '*○ㅇ〇OoXx×·・．. _-'
const MASK = /[*○ㅇ〇OoXx×·・．.\s_-]/g
const isMask = (ch) => MASK_CHARS.includes(ch)

/** 최*규 → 최진규 처럼, 가려진 자리를 빼고 위치가 전부 맞으면서 후보가 하나뿐일 때만 확정 */
export function matchMaskedName(label) {
  const chars = [...label]
  const hit = MEMBERS.filter(
    (m) => m.length === chars.length && [...m].every((c, i) => c === chars[i] || isMask(chars[i])),
  )
  return hit.length === 1 ? hit[0] : null
}

const KOREAN_TOKEN = /[가-힣][가-힣*○ㅇ〇OoXx×·・．._-]{0,4}/
const TOTAL_MIN = 50
const TOTAL_MAX = 200

/** 스코어카드에서 흔히 보이는, 사람 이름이 아닌 라벨 */
const NOT_A_NAME = /^(합계|총타수|총계|타수|전반|후반|코스|홀|파|스코어|순위|평균|핸디|네트|그로스|날짜|일자)/

export function findDate(lines) {
  for (const line of lines) {
    const m =
      line.match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/) ||
      line.match(/(20\d{2})(\d{2})(\d{2})/)
    if (!m) continue
    const [, y, mo, d] = m
    const month = Number(mo)
    const day = Number(d)
    if (month < 1 || month > 12 || day < 1 || day > 31) continue
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return ''
}

const DATE_FRAGMENT = /(20\d{2})\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?/g
const COURSE_LABEL = /(?:골프장|코스|장소|클럽)\s*[:：]\s*(.+)/
const COURSE_NAME = /[가-힣A-Za-z0-9]{2,18}\s?(?:CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|리조트)/i

export function findCourse(lines) {
  for (const line of lines) {
    const cleaned = line.replace(DATE_FRAGMENT, ' ').replace(/[|[\]()]/g, ' ').replace(/\s{2,}/g, ' ').trim()
    if (!cleaned) continue

    // "골프장: 남서울CC" 처럼 라벨이 붙은 경우가 가장 확실하다
    const labelled = cleaned.match(COURSE_LABEL)
    if (labelled) {
      const name = labelled[1].trim()
      if (name.length >= 2 && name.length <= 24) return name
    }

    const named = cleaned.match(COURSE_NAME)
    if (named) return named[0].trim()
  }

  // CC/GC 같은 표시가 흐리게 찍혀 안 잡히는 경우가 잦다.
  // 맨 윗줄들 중 사람 이름도 라벨도 아닌 한글 줄을 골프장명 후보로 본다.
  for (const line of lines.slice(0, 4)) {
    const cleaned = line.replace(DATE_FRAGMENT, ' ').trim()
    if (NOT_A_NAME.test(cleaned)) continue
    const korean = cleaned.match(/^[가-힣][가-힣\s]{2,20}/)
    if (!korean) continue
    const name = korean[0].trim()
    if (MEMBERS.some((m) => name.startsWith(m) || m.startsWith(name))) continue
    if (name.length >= 3) return name
  }
  return ''
}

/**
 * 한 줄에서 "이름 + 총타수"를 뽑는다.
 * 스코어카드는 홀별 타수 → 전반/후반 → 총타수 순으로 커지므로,
 * 50~200 범위에서 가장 큰 수를 총타수로 본다. (네트가 함께 찍혀도 그로스가 더 크다)
 */
export function findRows(lines) {
  const rows = []
  for (const line of lines) {
    const token = line.match(KOREAN_TOKEN)
    if (!token || NOT_A_NAME.test(token[0])) continue

    const totals = [...line.matchAll(/\d+/g)]
      .map((m) => Number(m[0]))
      .filter((n) => n >= TOTAL_MIN && n <= TOTAL_MAX)
    if (totals.length === 0) continue

    rows.push({ raw: line, label: token[0], score: Math.max(...totals) })
  }
  return rows
}

export function parseScorecard(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  return { date: findDate(lines), course: findCourse(lines), rows: findRows(lines), lines }
}

/**
 * OCR로 읽은 줄들을 실제 멤버에 배정한다.
 *
 * 스코어카드는 내려받은 사람만 이름이 전부 나오고 나머지는 성만 나오기 때문에,
 * "최"처럼 성이 겹치는 멤버가 서로 다른 타수로 두 줄 잡히면 사람이 골라줘야 한다.
 * 그런 묶음을 ambiguous 로 돌려준다. (동타면 누구에게 붙든 결과가 같으므로 그냥 배정)
 */
export function resolveMembers(rows) {
  const scores = Object.fromEntries(MEMBERS.map((m) => [m, null]))
  const claims = []

  for (const r of rows) {
    const clean = r.label.replace(MASK, '')
    const exact = MEMBERS.find((m) => m === clean) || matchMaskedName(r.label)
    if (exact) {
      claims.push({ kind: 'exact', member: exact, score: r.score, label: r.label })
      continue
    }
    if (BY_SURNAME[clean[0]]) {
      claims.push({ kind: 'surname', surname: clean[0], score: r.score, label: r.label })
    }
  }

  // 1) 이름이 전부 나온 줄부터 확정
  for (const c of claims) {
    if (c.kind === 'exact' && scores[c.member] === null) scores[c.member] = c.score
  }

  // 2) 성만 나온 줄들을 성별로 묶는다
  const groups = {}
  for (const c of claims) {
    if (c.kind !== 'surname') continue
    ;(groups[c.surname] ||= []).push(c)
  }

  const ambiguous = []
  const unassigned = []

  for (const [surname, entries] of Object.entries(groups)) {
    const candidates = BY_SURNAME[surname].filter((m) => scores[m] === null)

    if (candidates.length === 0) {
      unassigned.push(...entries)
      continue
    }
    if (candidates.length === 1) {
      scores[candidates[0]] = entries[0].score
      unassigned.push(...entries.slice(1))
      continue
    }

    const distinct = new Set(entries.map((e) => e.score))
    if (distinct.size === 1) {
      // 동타라 누구에게 붙여도 같다
      entries.slice(0, candidates.length).forEach((e, i) => (scores[candidates[i]] = e.score))
      continue
    }

    ambiguous.push({
      surname,
      candidates,
      entries: entries.slice(0, candidates.length).map((e) => ({ score: e.score, label: e.label })),
    })
  }

  return { scores, ambiguous, unassigned }
}

/**
 * 최근 평균이 낮은 멤버에게 낮은 타수를 붙이는 기본 추천안.
 * 기록이 없으면 추천하지 않는다(빈 값 반환).
 */
export function suggestAssignment(group, stats) {
  const haveAverages = group.candidates.every((m) => stats?.[m]?.average != null)
  if (!haveAverages) return null

  const byScore = [...group.entries].sort((a, b) => a.score - b.score)
  const byAverage = [...group.candidates].sort((a, b) => stats[a].average - stats[b].average)

  const map = {}
  byAverage.forEach((m, i) => (map[m] = byScore[i].score))
  return map
}
