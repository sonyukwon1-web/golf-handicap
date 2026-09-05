// 핸디캡 산정 로직 (순수 함수 모음)

export const MEMBERS = ['최진규', '최문창', '손유권', '이지수']
export const RECENT_N = 5

// 멤버별 고정 색상 (dataviz 카테고리 팔레트 슬롯 1~4, 인접쌍 검증 통과)
export const MEMBER_COLORS = {
  최진규: { light: '#2a78d6', dark: '#3987e5' },
  최문창: { light: '#eb6834', dark: '#d95926' },
  손유권: { light: '#1baf7a', dark: '#199e70' },
  이지수: { light: '#eda100', dark: '#c98500' },
}

export const isScore = (v) => typeof v === 'number' && Number.isFinite(v)

/** 날짜 오름차순, 같은 날짜면 입력 순서대로 정렬 */
export function sortRounds(rounds) {
  return [...rounds].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    return (a.createdAt || 0) - (b.createdAt || 0)
  })
}

/** 해당 멤버가 실제로 친 스코어만 시간순으로 */
export function scoresOf(sortedRounds, member) {
  return sortedRounds.map((r) => r.scores?.[member]).filter(isScore)
}

/** 최근 n경기 평균 (n경기 미만이면 있는 경기만으로). 기록이 없으면 null */
export function recentAverage(sortedRounds, member, n = RECENT_N) {
  const recent = scoresOf(sortedRounds, member).slice(-n)
  if (recent.length === 0) return null
  return recent.reduce((a, b) => a + b, 0) / recent.length
}

/**
 * 순위를 어떻게 매길지 — **화면 어디서나 같은 값을 본다.**
 *
 *   useHandicap : 핸디를 적용한 넷 스코어로 매길지. **기본은 끔**이다 —
 *                 카드에 찍힌 타수가 먼저이고, 핸디는 보고 싶을 때 켜는 것이다.
 *   cap         : 핸디 상한. 스물 몇 타씩 벌어지면 그날 잘 친 사람이 아무리
 *                 쳐도 못 이기는 판이 된다. 비우면(null) 상한 없음.
 */
export const DEFAULT_RANKING = { useHandicap: false, cap: null }

/** 상한이 있으면 거기서 자른다 */
function capped(handicap, cap) {
  if (handicap === null) return null
  return Number.isFinite(cap) && cap >= 0 ? Math.min(handicap, cap) : handicap
}

/**
 * 주어진 라운드 집합 기준의 멤버별 통계와 핸디캡.
 * 평균이 가장 낮은 멤버가 기준(핸디 0), 나머지는 (본인 평균 - 최저 평균) 반올림.
 *
 * **상한은 여기서 자른다** — 핸디를 켜든 끄든 화면에 적히는 수는 잘린 값이어야
 * 한다. 켜는 순간 다른 수가 나오면 무엇을 본 것인지 알 수 없다.
 */
export function computeStats(rounds, opts = DEFAULT_RANKING) {
  const sorted = sortRounds(rounds)
  const stats = {}

  for (const m of MEMBERS) {
    const all = scoresOf(sorted, m)
    const recent = all.slice(-RECENT_N)
    stats[m] = {
      member: m,
      total: all.length,
      recentCount: recent.length,
      average: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null,
      best: all.length ? Math.min(...all) : null,
      handicap: null,
      isBase: false,
    }
  }

  const averages = MEMBERS.map((m) => stats[m].average).filter((v) => v !== null)
  const baseAverage = averages.length ? Math.min(...averages) : null

  for (const m of MEMBERS) {
    const s = stats[m]
    if (s.average === null || baseAverage === null) continue
    s.handicap = capped(Math.round(s.average - baseAverage), opts?.cap)
    s.isBase = s.average === baseAverage
  }

  return { stats, baseAverage }
}

/**
 * 라운드별 상세 계산.
 * 각 라운드의 "당시 핸디"는 그 라운드까지의 기록으로 산정한 스냅샷이라
 * 가장 최근 라운드의 핸디는 화면에 표시되는 현재 핸디와 항상 일치한다.
 */
export function computeRoundDetails(rounds, opts = DEFAULT_RANKING) {
  const sorted = sortRounds(rounds)

  return sorted.map((round, i) => {
    const { stats } = computeStats(sorted.slice(0, i + 1), opts)

    const entries = MEMBERS.filter((m) => isScore(round.scores?.[m]))
      .map((m) => {
        const gross = round.scores[m]
        /*
         * 핸디를 끄면 **카드에 찍힌 타수 그대로** 겨룬다 (net === gross).
         * 켜도 기록이 한 번뿐이면 안 준다 — '평균' 이 그 날 타수 그 자체라
         * 핸디가 타수 차이를 그대로 상쇄해 전원 동타가 된다.
         */
        const handicap = opts?.useHandicap && stats[m].total >= 2 ? (stats[m].handicap ?? 0) : 0
        return { member: m, gross, handicap, net: gross - handicap }
      })
      .sort((a, b) => a.net - b.net || a.gross - b.gross)

    // 넷 스코어 동점은 공동 순위
    let rank = 0
    let prevNet = null
    entries.forEach((e, idx) => {
      if (prevNet === null || e.net !== prevNet) {
        rank = idx + 1
        prevNet = e.net
      }
      e.rank = rank
    })

    return { ...round, seq: i + 1, entries }
  })
}

/** 라운드가 쌓이는 순서대로 멤버별 최근 5경기 평균이 어떻게 변했는지 */
export function trendSeries(rounds) {
  const sorted = sortRounds(rounds)

  return MEMBERS.map((member) => {
    const points = []
    sorted.forEach((round, i) => {
      const avg = recentAverage(sorted.slice(0, i + 1), member)
      if (avg !== null) points.push({ x: i + 1, y: avg, date: round.date })
    })
    return { member, points }
  }).filter((s) => s.points.length > 0)
}

/**
 * 평균 타수 — **정수로 반올림한다.**
 *
 * 96.8 · 113.3 처럼 소수 한 자리를 적어 두었더니, 옆에 선 핸디(−6, −22)와
 * 자릿수가 어긋나 줄이 들쭉날쭉해 보였다. 0.1타는 이 앱에서 아무것도 가르지
 * 않는다 — 핸디는 어차피 정수로 반올림해서 쓴다.
 */
export function fmtAvg(v) {
  if (v === null || v === undefined) return '–'
  return String(Math.round(v))
}

export function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${y}.${m}.${d}`
}

export function fmtDateShort(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}
