// 카드에 적힌 이름(가려진 것 포함)을 우리 멤버와 맞춘다.

import { MEMBERS } from './handicap.js'

const MASK = /[*○ㅇ〇OoXx×·・．.”“'"\s_-]/g

/** 가능한 멤버 후보. 하나뿐이면 자동으로 배정할 수 있다. */
export function nameCandidates(label) {
  const chars = [...String(label || '').trim()]
  const bare = String(label || '').replace(MASK, '')
  if (!bare) return []

  const exact = MEMBERS.find((m) => m === bare)
  if (exact) return [exact]

  // 최*규 처럼 가려지지 않은 자리가 전부 맞는 경우
  const masked = MEMBERS.filter(
    (m) => m.length === chars.length && [...m].every((c, i) => c === chars[i] || MASK.test(chars[i])),
  )
  if (masked.length > 0) return masked

  return MEMBERS.filter((m) => m[0] === bare[0])
}
