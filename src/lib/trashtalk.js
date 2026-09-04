// 상황을 보고 도발 멘트 후보를 만든다. 실제로 뭘 보여줄지는 화면에서 하나 골라 쓴다.

import { MEMBERS, computeStats } from './handicap.js'
import { improvements, memberRecords } from './awards.js'

const pick = (arr) => arr.map((text) => ({ text }))

/** 상황별 멘트 풀. {n} 은 이름, {v} 는 숫자로 치환된다. */
const LINES = {
  streak: [
    '{n} {v}연승. 오늘도 밥값은 남의 지갑에서 나옵니다.',
    '{n} {v}연승 중… 슬슬 핸디 조정 들어갑니다. 각오하세요.',
    '{n} 폼 미쳤다. 이 정도면 내기 금액을 올려야 하는 거 아닌가요?',
    '{n} {v}연승. 나머지 세 분, 연습장은 다녀오셨나요?',
    '{n:은} 요즘 필드에서 제일 무서운 사람입니다.',
  ],
  doom: [
    '{n} {v}경기 연속 꼴찌… 이쯤 되면 실력이 아니라 운명입니다.',
    '{n} {v}경기째 꼴찌 지정석. 자리값이라도 받으셔야죠.',
    '{n} {v}연속 꼴찌 달성. 기록은 기록이니 축하는 드립니다.',
    '{n}, {v}경기 연속입니다. 클럽 탓 그만하고 연습장 갑시다.',
    '{n:을} 위한 위로의 박수 부탁드립니다. {v}경기째입니다.',
  ],
  handicapDoom: [
    '{n}, {v}타나 받고도 꼴찌… 괜찮아요?',
    '{n} 핸디 {v}타는 자비였는데, 그걸 또 못 살리네요.',
    '{n}에게 {v}타를 얹어줬는데도 결과가 이렇습니다. 더 드릴까요?',
  ],
  rising: [
    '{n} 평균이 {v}타나 줄었습니다. 몰래 레슨 받는 거 다 압니다.',
    '{n} 요즘 폼 미쳤다. 핸디 줄어들 예정이니 지금이 전성기입니다.',
    '{n} {v}타 개선. 이 속도면 다음 시즌엔 기준 멤버 됩니다.',
  ],
  falling: [
    '{n} 평균이 {v}타 올랐습니다. 겨울잠은 아직인데요.',
    '{n}, 요즘 무슨 일 있으세요? 스코어가 말을 안 듣네요.',
    '{n} 평균 {v}타 상승. 핸디는 늘어나니 그건 좋은 소식입니다.',
  ],
  base: [
    '기준은 {n}. 나머지 세 분은 오늘도 핸디 받고 시작합니다.',
    '{n:이} 핸디 0. 이 모임의 기준선이자 넘어야 할 벽입니다.',
    '{n} 앞에서 다들 겸손해집시다. 핸디 0의 무게가 있습니다.',
  ],
  king: [
    '통산 우승 {v}회, {n}. 트로피 놓을 자리는 마련해 두셨나요?',
    '{n:이} 통산 {v}승으로 선두. 나머지 분들 분발 좀 합시다.',
  ],
  idle: [
    '기록이 쌓여야 도발도 가능합니다. 일단 필드부터 나가시죠.',
    '아직 놀릴 거리가 없네요. 라운드 몇 번 더 돌고 옵시다.',
    '스코어카드를 올려주세요. 재미는 그때부터입니다.',
  ],
}

/** 받침이 있으면 앞 조사(이/은/을/과), 없으면 뒤 조사(가/는/를/와)를 쓴다 */
const hasFinalConsonant = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  return code >= 0 && code <= 11171 && code % 28 !== 0
}

const JOSA = { 이: ['이', '가'], 은: ['은', '는'], 을: ['을', '를'], 과: ['과', '와'] }

const fill = (line, name, value) =>
  line
    .replace(/\{n:([이은을과])\}/g, (_, j) => name + JOSA[j][hasFinalConsonant(name) ? 0 : 1])
    .replace('{n}', name)
    .replace('{v}', value)

/** 지금 데이터로 할 수 있는 도발을 전부 모아 돌려준다. */
export function trashTalk(rounds) {
  if (rounds.length === 0) return pick(LINES.idle)

  const rec = memberRecords(rounds)
  const imp = improvements(rounds)
  const { stats } = computeStats(rounds)
  const out = []

  for (const m of MEMBERS) {
    const r = rec[m]
    if (r.played === 0) continue

    if (r.winStreak >= 2) out.push(...LINES.streak.map((l) => ({ text: fill(l, m, r.winStreak) })))

    if (r.lastStreak >= 2) {
      out.push(...LINES.doom.map((l) => ({ text: fill(l, m, r.lastStreak) })))
      const h = stats[m].handicap
      if (h > 0) out.push(...LINES.handicapDoom.map((l) => ({ text: fill(l, m, h) })))
    }

    if (imp[m] != null && imp[m] >= 2) {
      out.push(...LINES.rising.map((l) => ({ text: fill(l, m, imp[m].toFixed(1)) })))
    }
    if (imp[m] != null && imp[m] <= -2) {
      out.push(...LINES.falling.map((l) => ({ text: fill(l, m, Math.abs(imp[m]).toFixed(1)) })))
    }
  }

  const baseMember = MEMBERS.find((m) => stats[m].isBase)
  if (baseMember) out.push(...LINES.base.map((l) => ({ text: fill(l, baseMember, '') })))

  const most = Math.max(...MEMBERS.map((m) => rec[m].wins))
  if (most > 0) {
    const king = MEMBERS.filter((m) => rec[m].wins === most)
    if (king.length === 1) out.push(...LINES.king.map((l) => ({ text: fill(l, king[0], most) })))
  }

  return out.length ? out : pick(LINES.idle)
}
