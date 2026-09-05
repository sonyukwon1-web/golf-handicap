// 스코어카드 판독 API. 브라우저에서 직접 Claude 를 부르면 키가 노출되므로 여기를 거친다.
// 사진은 Anthropic 으로만 전달되고 저장하지 않는다.

import { BadInput, readScorecard } from './_scorecard.js'

/** Anthropic 쪽 오류를 쓰는 사람이 알아볼 수 있는 말로 바꾼다 */
function explain(message) {
  if (/credit balance is too low|insufficient/i.test(message)) {
    return {
      status: 402,
      text: '판독에 쓰는 Claude 크레딧이 떨어졌습니다. Claude 콘솔의 Plans & Billing 에서 충전한 뒤 다시 시도해 주세요. 그때까지는 아래 표에 직접 입력하시면 됩니다.',
    }
  }
  if (/rate limit|429/i.test(message)) {
    return { status: 429, text: '판독 요청이 몰렸습니다. 잠시 뒤 다시 시도해 주세요.' }
  }
  if (/authentication|invalid x-api-key|401/i.test(message)) {
    return { status: 401, text: '판독 서버의 API 키가 올바르지 않습니다. Vercel 환경 변수를 확인해 주세요.' }
  }
  if (/overloaded|529|timeout|ETIMEDOUT/i.test(message)) {
    return { status: 503, text: '판독 서버가 잠시 붐빕니다. 조금 뒤 다시 시도해 주세요.' }
  }
  return { status: 500, text: `판독 중 오류가 발생했습니다: ${message}` }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로 보내 주세요' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: '서버에 ANTHROPIC_API_KEY 가 설정되지 않았습니다' })
  }

  try {
    const { image, mediaType } = req.body || {}
    const { result } = await readScorecard({ image, mediaType, apiKey })
    return res.status(200).json({ result })
  } catch (err) {
    if (err instanceof BadInput) return res.status(400).json({ error: err.message })
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    const { status, text } = explain(message)
    return res.status(status).json({ error: text })
  }
}
