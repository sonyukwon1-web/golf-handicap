// 같은 스코어카드를 두 번 등록하는 것을 막는다.

import { MEMBERS } from './handicap.js'

const scoresKey = (round) => MEMBERS.map((m) => round.scores?.[m] ?? '-').join('/')

/**
 * 같은 라운드로 볼지 판단한다.
 * 날짜가 같고 네 명의 타수가 모두 같으면 같은 라운드다.
 * 골프장 이름은 인식이 조금씩 달라질 수 있어 판단에 쓰지 않는다.
 */
export function isSameRound(a, b) {
  if (!a || !b || a.date !== b.date) return false
  return scoresKey(a) === scoresKey(b)
}

/** 이미 등록된 것 중 같은 라운드를 찾는다 */
export function findDuplicate(rounds, candidate) {
  return rounds.find((r) => r.id !== candidate.id && isSameRound(r, candidate)) || null
}
