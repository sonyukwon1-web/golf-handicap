import { DEFAULT_RANKING, MEMBERS, isScore } from './handicap.js'
import { HOLES, completeTotal } from './holes.js'

const KEY = 'golf-handicap:v1'

export const emptyData = () => ({
  version: 3,
  members: MEMBERS,
  rounds: [],
  ranking: { ...DEFAULT_RANKING },
  updatedAt: 0,
})

/** 길이 18의 숫자 배열로 맞춘다. 값이 없거나 범위를 벗어나면 null. */
function holeArray(raw, { min, max }) {
  if (!Array.isArray(raw)) return null
  const out = Array(HOLES).fill(null)
  let any = false
  for (let i = 0; i < HOLES; i++) {
    const v = Number(raw[i])
    if (raw[i] === null || raw[i] === '' || !Number.isFinite(v)) continue
    if (v < min || v > max) continue
    out[i] = Math.round(v)
    any = true
  }
  return any ? out : null
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 외부(파일/스토리지)에서 들어온 값을 신뢰하지 않고 정규화한다 */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return emptyData()
  const rounds = Array.isArray(raw.rounds) ? raw.rounds : []

  const clean = rounds
    .filter((r) => r && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .map((r, i) => {
      const scores = {}
      for (const m of MEMBERS) {
        const v = Number(r.scores?.[m])
        scores[m] = r.scores?.[m] === null || r.scores?.[m] === '' || !Number.isFinite(v) ? null : v
      }
      // 홀별 기록은 나중에 생긴 형식이라 없을 수 있다 (총 타수만 적은 옛 라운드).
      const pars = holeArray(r.pars, { min: 3, max: 6 })
      let holes = null
      if (pars && r.holes && typeof r.holes === 'object') {
        const collected = {}
        let any = false
        for (const m of MEMBERS) {
          const arr = holeArray(r.holes[m], { min: -4, max: 12 })
          collected[m] = arr
          if (arr) any = true
        }
        holes = any ? collected : null
      }

      // 홀별로 18홀이 다 있으면 총 타수는 파 합계 + 오버 합계로 다시 계산한다
      if (pars && holes) {
        for (const m of MEMBERS) {
          const total = holes[m] ? completeTotal(pars, holes[m]) : null
          if (total !== null) scores[m] = total
        }
      }

      const str = (v) => (typeof v === 'string' ? v.trim() : '')

      // 카드에 적혀 있던 이름 순서 (없으면 기본 순서를 쓴다)
      const order = Array.isArray(r.order)
        ? [...new Set(r.order.filter((m) => MEMBERS.includes(m)))]
        : null

      return {
        id: typeof r.id === 'string' && r.id ? r.id : newId(),
        date: r.date,
        course: str(r.course),
        teeTime: /^\d{1,2}:\d{2}$/.test(str(r.teeTime)) ? str(r.teeTime) : '',
        courseFront: str(r.courseFront),
        courseBack: str(r.courseBack),
        pars,
        holes,
        order: order && order.length ? order : null,
        scores,
        createdAt: Number.isFinite(Number(r.createdAt)) ? Number(r.createdAt) : i,
      }
    })
    .filter((r) => MEMBERS.some((m) => isScore(r.scores[m])))

  /*
    순위 매기는 방식 — 핸디를 켜 두었는지, 상한을 얼마로 두었는지.
    없으면(옛 자료) 기본값 — **핸디 끔**이다.
  */
  const r = raw.ranking || {}
  /*
    **상한 없음(null)을 0 으로 읽지 않는다.**

    `Number(null)` 은 0 이다. 그래서 '상한 없음' 으로 담아 둔 것을 다시 읽으면
    상한 0 이 되어, 네 명 핸디가 전부 0 으로 잘렸다 — 앱을 새로 열 때마다
    핸디가 사라지던 까닭이다. 숫자로 담긴 것만 숫자로 읽는다.
  */
  const cap = typeof r.cap === 'number' && Number.isFinite(r.cap) && r.cap > 0 ? Math.round(r.cap) : null
  const ranking = { cap }

  /* 벌칙은 걷어냈다 — 담겨 있던 값이 있어도 읽지 않고 버린다 */
  /* 언제 고친 것인가 — 기기끼리 맞출 때 늦은 쪽이 이긴다 (lib/sync.js) */
  const updatedAt = Number(raw.updatedAt)

  return {
    version: 3,
    members: MEMBERS,
    rounds: clean,
    ranking,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    return normalize(JSON.parse(raw))
  } catch {
    return emptyData()
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/* 내보내기·불러오기는 걷어냈다 — 기기끼리 저절로 맞춰지므로 손으로 옮길 일이 없다 */
