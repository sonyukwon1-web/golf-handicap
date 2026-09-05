// 이름 뒤 조사를 받침에 맞춰 고른다.
//
// "최문창가" 처럼 어긋나면 눈에 확 띈다. 이름은 자료에서 오므로 문장에 붙여 쓸 수 없고,
// 마지막 글자의 받침을 보고 골라야 한다.

const PAIRS = {
  '이/가': ['이', '가'],
  '은/는': ['은', '는'],
  '을/를': ['을', '를'],
  '과/와': ['과', '와'],
  '으로/로': ['으로', '로'],
}

/** 마지막 글자에 받침이 있는지. 한글이 아니면 없는 것으로 본다. */
export function hasFinalConsonant(word) {
  const text = String(word || '').trim()
  if (!text) return false

  const code = text.charCodeAt(text.length - 1) - 0xac00
  if (code < 0 || code > 11171) return false
  return code % 28 !== 0
}

/**
 * 이름에 맞는 조사를 돌려준다.
 *   josa('최문창', '이/가') → '이'
 *   josa('최진규', '이/가') → '가'
 *
 * 가려진 이름(최**)처럼 한글로 끝나지 않으면 받침 없는 쪽을 쓴다.
 */
export function josa(word, pair) {
  const [withBatchim, without] = PAIRS[pair] || []
  if (!withBatchim) throw new Error(`모르는 조사: ${pair}`)
  return hasFinalConsonant(word) ? withBatchim : without
}

/** 이름과 조사를 붙여 준다. josaWith('최문창', '이/가') → '최문창이' */
export const josaWith = (word, pair) => `${word}${josa(word, pair)}`
