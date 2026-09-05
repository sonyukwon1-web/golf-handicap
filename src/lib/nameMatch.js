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

  /*
    ══════════════════════════════════════════════════════════
    **다 보이는 이름이 안 맞으면 우리 멤버가 아니다.**

    성만 보고 짐작하던 자리다. 그래서 손님 '이철수' 가 후보 하나(이지수)로
    좁혀져 **묻지도 않고 이지수 기록에 들어앉았다.** 남의 타수가 우리 평균과
    핸디를 통째로 흔든다.

    성만으로 짐작하는 것은 **가려진 이름일 때만** 뜻이 있다 — '최**' 는 정말
    우리 둘 중 하나일 수 있지만, '이철수' 는 그냥 이철수다. 빈 배열을 돌려주면
    그 줄은 배정되지 않고 타수도 버려진다.
    ══════════════════════════════════════════════════════════
  */
  const 가려짐 = chars.some((c) => MASK.test(c))
  if (!가려짐) return []

  return MEMBERS.filter((m) => m[0] === bare[0])
}
