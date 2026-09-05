// 명예의 전당 · 배지 · 라이벌 전적 · 시즌 랭킹 계산 (순수 함수)

import { MEMBERS, computeRoundDetails, scoresOf, sortRounds } from './handicap.js'

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length

/** 라운드별 우승자/꼴찌를 붙인다. 동점이면 공동으로 본다. */
export function roundOutcomes(rounds) {
  return computeRoundDetails(rounds).map((r) => {
    const nets = r.entries.map((e) => e.net)
    const worstNet = nets.length ? Math.max(...nets) : null
    return {
      ...r,
      winners: r.entries.filter((e) => e.rank === 1).map((e) => e.member),
      // 혼자 친 라운드에 꼴찌는 없다
      losers: r.entries.length >= 2 ? r.entries.filter((e) => e.net === worstNet).map((e) => e.member) : [],
    }
  })
}

/** 통산 우승/꼴찌 횟수, 베스트/워스트, 현재 연승·연속꼴찌 */
export function memberRecords(rounds) {
  const outcomes = roundOutcomes(rounds)
  const sorted = sortRounds(rounds)
  const rec = {}

  for (const m of MEMBERS) {
    const grosses = scoresOf(sorted, m)
    rec[m] = {
      member: m,
      played: grosses.length,
      wins: 0,
      lasts: 0,
      best: grosses.length ? Math.min(...grosses) : null,
      worst: grosses.length ? Math.max(...grosses) : null,
      winStreak: 0,
      lastStreak: 0,
    }
  }

  for (const o of outcomes) {
    o.winners.forEach((m) => rec[m].wins++)
    o.losers.forEach((m) => rec[m].lasts++)
  }

  // 연속 기록은 본인이 나간 라운드만 최신순으로 훑는다
  for (const m of MEMBERS) {
    const mine = outcomes.filter((o) => o.entries.some((e) => e.member === m)).reverse()
    let ws = 0
    for (const o of mine) {
      if (!o.winners.includes(m)) break
      ws++
    }
    let ls = 0
    for (const o of mine) {
      if (!o.losers.includes(m)) break
      ls++
    }
    rec[m].winStreak = ws
    rec[m].lastStreak = ls
  }

  return rec
}

/**
 * 발전폭 = 직전 5경기 평균 − 최근 5경기 평균. 양수면 그만큼 좋아진 것.
 * 한 달에 한 번 치는 모임이라 "이번 달"만 보면 표본이 한 경기뿐이어서,
 * 최근 5경기와 그 앞 5경기를 견준다.
 */
export function improvements(rounds) {
  const sorted = sortRounds(rounds)
  const out = {}

  for (const m of MEMBERS) {
    const s = scoresOf(sorted, m)
    const recent = s.slice(-5)
    const prior = s.slice(-10, -5)
    out[m] = recent.length >= 2 && prior.length >= 2 ? mean(prior) - mean(recent) : null
  }
  return out
}

/** 그로스 표준편차. 작을수록 기복이 없다. */
export function consistency(rounds) {
  const sorted = sortRounds(rounds)
  const out = {}

  for (const m of MEMBERS) {
    const s = scoresOf(sorted, m)
    if (s.length < 3) {
      out[m] = null
      continue
    }
    const avg = mean(s)
    out[m] = Math.sqrt(mean(s.map((v) => (v - avg) ** 2)))
  }
  return out
}

/** 멤버별 배지. 발전상·안정왕은 한 명에게만 붙는다. */
export function badges(rounds) {
  const rec = memberRecords(rounds)
  const imp = improvements(rounds)
  const dev = consistency(rounds)
  const out = Object.fromEntries(MEMBERS.map((m) => [m, []]))

  for (const m of MEMBERS) {
    if (rec[m].winStreak >= 2) {
      out[m].push({
        id: 'streak', icon: '🔥', tone: 'hot',
        label: `${rec[m].winStreak}연승 중`,
        detail: `핸디 적용 후 ${rec[m].winStreak}연승 중`,
      })
    }
    if (rec[m].lastStreak >= 3) {
      out[m].push({
        id: 'doom', icon: '💀', tone: 'doom',
        label: `${rec[m].lastStreak}연속 꼴찌`,
        detail: `${rec[m].lastStreak}경기 연속 꼴찌`,
      })
    }
  }

  const improved = MEMBERS.filter((m) => imp[m] != null).sort((a, b) => imp[b] - imp[a])[0]
  if (improved && imp[improved] >= 1) {
    out[improved].push({
      id: 'improve', icon: '📈', tone: 'good',
      label: `발전상 ${imp[improved].toFixed(1)}타↓`,
      detail: `최다 발전상 — 직전 5경기 대비 평균 ${imp[improved].toFixed(1)}타 줄었습니다`,
    })
  }

  const steady = MEMBERS.filter((m) => dev[m] != null).sort((a, b) => dev[a] - dev[b])[0]
  if (steady) {
    out[steady].push({
      id: 'steady', icon: '🎯', tone: 'calm',
      label: `안정왕 ±${dev[steady].toFixed(1)}`,
      detail: `안정왕 — 그로스 표준편차 ${dev[steady].toFixed(1)}타로 기복이 가장 적습니다`,
    })
  }

  return out
}

/** 두 멤버가 함께 친 라운드만 모아 넷 스코어로 1:1 전적을 낸다. */
export function headToHead(rounds, a, b) {
  const shared = roundOutcomes(rounds).filter(
    (o) => o.entries.some((e) => e.member === a) && o.entries.some((e) => e.member === b),
  )

  let aWins = 0
  let bWins = 0
  let draws = 0
  let grossGap = 0
  const history = []

  for (const o of shared) {
    const ea = o.entries.find((e) => e.member === a)
    const eb = o.entries.find((e) => e.member === b)

    if (ea.net < eb.net) aWins++
    else if (eb.net < ea.net) bWins++
    else draws++

    grossGap += ea.gross - eb.gross
    history.push({
      id: o.id,
      date: o.date,
      course: o.course,
      a: ea,
      b: eb,
      winner: ea.net < eb.net ? a : eb.net < ea.net ? b : null,
    })
  }

  return {
    played: shared.length,
    aWins,
    bWins,
    draws,
    avgGrossGap: shared.length ? grossGap / shared.length : null,
    history: history.slice(-5).reverse(),
  }
}

/** 순위 포인트: 1등 4점 … 4등 1점. 공동 순위는 같은 점수를 받는다. */
export const rankPoints = (rank) => Math.max(1, 5 - rank)

/** 연도별 시즌 랭킹. 최신 시즌이 먼저. */
export function seasons(rounds) {
  const byYear = new Map()

  for (const o of roundOutcomes(rounds)) {
    const year = o.date.slice(0, 4)
    if (!byYear.has(year)) {
      byYear.set(year, {
        year,
        rounds: 0,
        points: Object.fromEntries(MEMBERS.map((m) => [m, 0])),
        played: Object.fromEntries(MEMBERS.map((m) => [m, 0])),
      })
    }
    const s = byYear.get(year)
    s.rounds++
    for (const e of o.entries) {
      s.points[e.member] += rankPoints(e.rank)
      s.played[e.member]++
    }
  }

  return [...byYear.values()]
    .sort((x, y) => y.year.localeCompare(x.year))
    .map((s) => {
      const table = MEMBERS.map((m) => ({ member: m, points: s.points[m], played: s.played[m] }))
        .filter((r) => r.played > 0)
        .sort((a, b) => b.points - a.points)

      const top = table.length ? table[0].points : 0
      return { ...s, table, champions: table.filter((r) => r.points === top).map((r) => r.member) }
    })
}
