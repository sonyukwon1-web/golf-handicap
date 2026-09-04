// 스코어카드 판독 API. 브라우저에서 직접 Claude 를 부르면 키가 노출되므로 여기를 거친다.
// 사진은 Anthropic 으로만 전달되고 저장하지 않는다.

import { BadInput, readScorecard } from './_scorecard.js'

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
    return res.status(500).json({ error: `판독 중 오류가 발생했습니다: ${message}` })
  }
}
