// 홀별 기록 모델과 그로부터 나오는 통계 (순수 함수)
//
// 셀에 담기는 값은 "실제 타수"가 아니라 파 대비 오버 타수다. 0 은 파, -1 은 버디,
// 2 는 더블보기. 실제 타수는 par + over 로 계산한다.

import { MEMBERS } from './handicap.js'

export const HOLES = 18
export const FRONT = 9

export const emptyPars = () => Array(HOLES).fill(null)
export const emptyOvers = () => Array(HOLES).fill(null)

const num = (v) => (Number.isFinite(v) ? v : null)

/** 파와 오버가 모두 들어온 홀만 세어 그로스를 더한다. */
export function grossOf(pars, overs, from = 0, to = HOLES) {
  if (!pars || !overs) return { strokes: 0, filled: 0 }
  let strokes = 0
  let filled = 0
  for (let i = from; i < to; i++) {
    const p = num(pars[i])
    const o = num(overs[i])
    if (p === null || o === null) continue
    strokes += p + o
    filled++
  }
  return { strokes, filled }
}

/** 18홀이 모두 채워졌을 때만 총 타수를 돌려준다. 아니면 null. */
export function completeTotal(pars, overs) {
  const { strokes, filled } = grossOf(pars, overs)
  return filled === HOLES ? strokes : null
}

export const parTotal = (pars, from = 0, to = HOLES) =>
  (pars || []).slice(from, to).reduce((sum, p) => sum + (num(p) ?? 0), 0)

export const overTotal = (overs, from = 0, to = HOLES) =>
  (overs || []).slice(from, to).reduce((sum, o) => sum + (num(o) ?? 0), 0)

/** 라운드에 홀별 기록이 쓸 만큼 들어있는지 */
export function hasHoleData(round) {
  if (!round?.pars || !round?.holes) return false
  return MEMBERS.some((m) => (round.holes[m] || []).some((v) => num(v) !== null))
}

/** 스코어카드 검산: 파 합계 + 오버 합계 == T열 값 */
/**
 * 한 나인이 카드의 T 와 맞는가 — **어긋난 자리를 나인 단위로 좁힌다.**
 *
 * 18홀 합계만 보면 어긋났다는 것은 알아도 어디가 틀렸는지는 모른다. 전반·후반을
 * 따로 재면 아홉 칸으로 좁혀지고, 사람은 그 아홉 칸만 카드와 견주면 된다.
 *
 *   { ok: true|false|null, computed, claimed, blanks: [홀 번호…] }
 *   ok === null  → 견줄 것이 없다 (카드의 T 를 못 읽었거나 칸이 비었다)
 */
export function verifyNine(pars, overs, claimedTotal, from, to) {
  const blanks = []
  let strokes = 0
  for (let i = from; i < to; i++) {
    const p = num(pars?.[i])
    const o = num(overs?.[i])
    if (p === null || o === null) blanks.push(i)
    else strokes += p + o
  }
  if (blanks.length > 0) return { ok: null, computed: null, claimed: claimedTotal ?? null, blanks }
  if (!Number.isFinite(claimedTotal)) return { ok: null, computed: strokes, claimed: null, blanks }
  return { ok: strokes === claimedTotal, computed: strokes, claimed: claimedTotal, blanks }
}

export function verifyRow(pars, overs, claimedTotal) {
  const computed = completeTotal(pars, overs)
  if (computed === null) return { ok: null, computed: null, claimed: claimedTotal }
  if (!Number.isFinite(claimedTotal)) return { ok: null, computed, claimed: null }
  return { ok: computed === claimedTotal, computed, claimed: claimedTotal }
}

// ── 홀별 기록에서 뽑는 재미 통계 ─────────────────────────

/** 홀별 기록이 있는 라운드에서 (member, par, over) 를 전부 펼친다 */
function flatten(rounds) {
  const out = []
  for (const r of rounds) {
    if (!hasHoleData(r)) continue
    for (const m of MEMBERS) {
      const overs = r.holes?.[m]
      if (!overs) continue
      for (let i = 0; i < HOLES; i++) {
        const p = num(r.pars[i])
        const o = num(overs[i])
        if (p === null || o === null) continue
        out.push({ member: m, hole: i, par: p, over: o })
      }
    }
  }
  return out
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)

/**
 * 홀별 기록 기반 통계 묶음.
 * 표본이 모자라면 해당 항목은 null 로 비운다 (억지 순위를 만들지 않는다).
 */
export function holeStats(rounds) {
  const rows = flatten(rounds)
  if (rows.length === 0) return null

  const per = Object.fromEntries(MEMBERS.map((m) => [m, rows.filter((r) => r.member === m)]))
  const played = MEMBERS.filter((m) => per[m].length > 0)
  if (played.length === 0) return null

  const parAvg = (m, par) => {
    const hit = per[m].filter((r) => r.par === par)
    return hit.length >= 4 ? mean(hit.map((r) => r.over)) : null
  }

  const collapse = (m) => {
    const front = per[m].filter((r) => r.hole < FRONT)
    const back = per[m].filter((r) => r.hole >= FRONT)
    if (front.length < 9 || back.length < 9) return null
    return mean(back.map((r) => r.over)) - mean(front.map((r) => r.over))
  }

  const lowest = (values) => {
    const entries = played.map((m) => [m, values(m)]).filter(([, v]) => v !== null)
    if (entries.length < 2) return null
    return entries.sort((a, b) => a[1] - b[1])[0]
  }
  const highest = (values) => {
    const entries = played.map((m) => [m, values(m)]).filter(([, v]) => v !== null)
    if (entries.length < 2) return null
    return entries.sort((a, b) => b[1] - a[1])[0]
  }

  const countBy = (m, fn) => per[m].filter(fn).length

  const birdies = played.map((m) => [m, countBy(m, (r) => r.over <= -1)]).sort((a, b) => b[1] - a[1])
  /*
   * 양파 = 파의 두 배 타수. over 가 par 와 같으면 양파다 (파4에 8타).
   *
   * **그보다 더 친 것도 센다.** 딱 두 배만 세면 파4에 9타를 친 날이 아무 데도
   * 안 잡힌다 — 더 못 쳤는데 기록에서 사라지는 셈이다.
   */
  const doubles = played.map((m) => [m, countBy(m, (r) => r.over >= r.par)]).sort((a, b) => b[1] - a[1])

  return {
    rounds: rounds.filter(hasHoleData).length,
    par3: lowest((m) => parAvg(m, 3)),
    par5: lowest((m) => parAvg(m, 5)),
    /*
      **아무도 안 무너졌으면 왕을 세우지 않는다.**

      넷 다 후반이 더 좋았던 날에도 '후반 무너짐 — 손유권 0.0타' 가 떴다.
      가장 덜 좋아진 사람일 뿐인데 무너졌다고 적히니, 잘 친 사람이 상처를
      받는다. 버디·양파를 0회면 감추는 것과 같은 잣대다.
    */
    collapse: (() => { const top = highest(collapse); return top && top[1] > 0 ? top : null })(),
    birdie: birdies[0]?.[1] > 0 ? birdies[0] : null,
    doublePar: doubles[0]?.[1] > 0 ? doubles[0] : null,
    table: played.map((m) => ({
      member: m,
      holes: per[m].length,
      par3: parAvg(m, 3),
      par5: parAvg(m, 5),
      collapse: collapse(m),
      birdies: countBy(m, (r) => r.over <= -1),
      doublePars: countBy(m, (r) => r.over >= r.par),
    })),
  }
}
