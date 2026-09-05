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

/**
 * 라운드마다 **몇 번째로 친 필드인지** 번호를 매긴다 — 가장 오래된 것이 1번.
 *
 * 날짜만 적혀 있으면 '이게 몇 번째였더라' 를 세어 봐야 알았다. 번호는 늘
 * **전체 라운드**를 기준으로 매긴다 — 화면에서 한 해만 걸러 보더라도
 * 3번은 3번이어야 한다. 걸러진 목록으로 다시 매기면 같은 라운드가 화면마다
 * 다른 번호를 달게 된다.
 *
 *   Map(라운드 id → 번호)
 */
export function roundNumbers(rounds) {
  const map = new Map()
  sortRounds(rounds).forEach((r, i) => map.set(r.id, i + 1))
  return map
}

/**
 * 번호를 **동그라미 안 숫자**로 — ①②③…
 *
 * 드롭다운 항목처럼 글자만 넣을 수 있는 자리에서 쓴다. 그림을 그릴 수 있는
 * 자리(카드·그래프)는 진짜 동그라미를 그리므로 이 함수를 안 쓴다.
 *
 * 유니코드에 있는 것은 ①–⑳(1–20) · ㉑–㉟(21–35) · ㊱–㊿(36–50) 까지다.
 * 그 너머는 동그라미가 아예 없으므로 `51.` 로 물러선다 — 없는 글자를 억지로
 * 넣으면 네모(두부)가 뜬다.
 */
export function circled(n) {
  if (!Number.isInteger(n) || n < 1) return ''
  if (n <= 20) return String.fromCodePoint(0x2460 + n - 1)
  if (n <= 35) return String.fromCodePoint(0x3251 + n - 21)
  if (n <= 50) return String.fromCodePoint(0x32b1 + n - 36)
  return `${n}.`
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
 * 핸디를 어떻게 낼지 — **화면 어디서나 같은 값을 본다.**
 *
 *   cap : 핸디 상한. 스물 몇 타씩 벌어지면 봐주는 폭이 너무 커진다.
 *         비우면(null) 상한 없음.
 *
 * **순위는 늘 친 타수로 매긴다.** 한때 '핸디 적용해서 순위 보기'
 * 스위치가 있었는데, 넷이 제 평균대로 치면 전원 동타가 되는 셈이라 순위를
 * 가리는 데는 쓸모가 없었다. 핸디는 다음 판을 짤 때 보는 값으로만 남긴다.
 */
export const DEFAULT_RANKING = { cap: null }

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
    /*
      ══════════════════════════════════════════════════════════
      **화면에 적힌 수끼리 빼야 한다.**

      여태 반올림하기 **전** 평균끼리 뺀 뒤 반올림했다. 그런데 화면에 적히는
      평균은 이미 반올림한 값이라, 117 과 90 이 나란히 적혀 있는데 핸디는
      26 이 되는 일이 생겼다 (116.6 − 90.4 = 26.2). 보는 사람은 27 을 셈하고
      앱은 26 을 적으니 어느 쪽이 틀렸는지 알 수가 없다.

      **적히는 값으로 뺀다.** 기준 평균이 가장 낮으므로 반올림한 뒤에도
      순서가 뒤집히지 않아, 핸디가 음수가 될 일은 없다.
      ══════════════════════════════════════════════════════════
    */
    s.handicap = capped(Math.round(s.average) - Math.round(baseAverage), opts?.cap)
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
    /*
      **그 라운드까지 넣어 핸디를 낸다.**

      한때 직전까지로만 냈다 — 오늘 성적이 오늘 핸디를 바꾸지 않게 하려던 것인데,
      쓰는 쪽의 뜻은 달랐다. 이 앱의 핸디는 '오늘 판을 가르는 값' 이기 전에
      **최근 다섯 번 친 실력** 이고, 그것을 보고 다음 판을 짠다. 그러니 방금 친
      라운드도 그 다섯에 들어야 한다.

      (그 대신 잘 친 날은 제 핸디를 조금 깎는다. 다섯 라운드에 한 번 섞이는
      값이라 그 몫은 5분의 1쯤이다.)
    */
    const { stats } = computeStats(sorted.slice(0, i + 1), opts)

    const entries = MEMBERS.filter((m) => isScore(round.scores?.[m]))
      .map((m) => {
        const gross = round.scores[m]
        /*
         * **순위는 친 타수 그대로.** 핸디는 옆에 적어만 둔다 — 화면이 '이 사람
         * 요즘 실력이 이만큼' 을 함께 보여 줄 수 있게. 순위를 가르지는 않는다.
         */
        const handicap = stats[m].total >= 2 ? (stats[m].handicap ?? 0) : 0
        return { member: m, gross, handicap, net: gross }
      })
      .sort((a, b) => a.net - b.net || a.gross - b.gross)

    // 같은 타수는 공동 순위
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
