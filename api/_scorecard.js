import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5'
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

// 구조화 출력 스키마는 minItems/maxItems 를 받지 않는다. 길이는 프롬프트로 지시하고 아래에서 검증한다.
const holeArray = { type: 'array', items: { type: 'integer' } }

const SCHEMA = {
  type: 'object',
  properties: {
    course: { type: 'string', description: '골프장 이름. 예: 리앤리, 은화삼' },
    date: { type: 'string', description: 'YYYY-MM-DD. 못 찾으면 빈 문자열' },
    teeTime: { type: 'string', description: 'HH:MM. 못 찾으면 빈 문자열' },
    courseFront: { type: 'string', description: '전반 코스 이름. 예: Sky' },
    courseBack: { type: 'string', description: '후반 코스 이름. 예: Lake' },
    pars: { ...holeArray, description: '1~18번 홀의 파. 위 표 9개 + 아래 표 9개, 정확히 18개' },
    rows: {
      type: 'array',
      description: '표에 나온 순서 그대로. 첫 줄이 카드 주인이다.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', description: '표에 적힌 이름 그대로. 예: 손유권, 최**, 이**' },
          overs: { ...holeArray, description: '1~18번 홀의 파 대비 오버 타수, 정확히 18개' },
          frontTotal: { type: 'integer', description: '전반 T 열의 값 (그 9홀 그로스 합계)' },
          backTotal: { type: 'integer', description: '후반 T 열의 값' },
        },
        required: ['label', 'overs', 'frontTotal', 'backTotal'],
        additionalProperties: false,
      },
    },
  },
  required: ['course', 'date', 'teeTime', 'courseFront', 'courseBack', 'pars', 'rows'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `골프장 앱의 스코어카드 캡처 화면을 읽어 홀별 기록을 뽑아내는 일을 한다.

[카드 구조]
- 맨 위: 골프장 이름, 날짜와 티오프 시각.
- 그 오른쪽 큰 파란 숫자 = 카드를 받은 사람의 총타수, 바로 밑이 그 사람 이름(실명).
- 그 아래 요약 카드: 나머지 사람들의 가려진 이름(이**, 최**)과 총타수가 왼쪽부터 나온다.
- 표는 9홀짜리 두 개다. **위 표가 전반 1~9홀, 아래 표가 후반 10~18홀**이다.
  아래 표의 홀 번호도 1~9 로 다시 시작하지만 실제로는 10~18번 홀이다.
- 각 표는 HOLE 행(홀 번호와 T), PAR 행, 그리고 플레이어 행들로 되어 있다.

[값을 읽는 법]
- PAR 행의 숫자는 그 홀의 파다. 5 면 파5(다섯 번에 넣으면 파).
- 플레이어 칸의 숫자는 **실제 타수가 아니라 파 대비 오버 타수**다.
  0 은 파, 1 은 보기, -1 은 버디.
- 버디 이하는 나비·원 같은 그림 안에 적혀 있을 수 있다. 그림에 가려도 그 안의
  숫자를 읽고, **마이너스 부호를 빠뜨리지 마라**.
- T 열은 그 9홀의 그로스 합계다(오버 합이 아니다).

[순서]
- 표의 첫 줄은 항상 카드를 받은 사람이다. 그 사람의 실명이 맨 위 파란 숫자 밑에 있다.
- 요약 카드의 사람들은 표의 두 번째 줄부터 같은 순서로 이어진다.
- label 에는 표에 적힌 이름을 그대로 넣는다. 가려져 있으면 가려진 그대로(최**).

[검산]
- 각 9홀마다 (PAR 합계 + 오버 합계) 가 T 열 값과 같아야 한다.
- 맞지 않으면 그 9홀을 다시 읽어라. 특히 그림에 가려진 칸과 붙어 있는 칸을 의심하라.

[길이]
- pars 와 각 줄의 overs 는 **반드시 정확히 18개**여야 한다. 위 표 9개 다음에 아래 표 9개.
- 못 읽은 칸이 있어도 자리를 비우지 말고 가장 그럴듯한 값을 넣되, 검산이 맞도록 맞춰라.

읽을 수 없는 문자열 항목은 빈 문자열로 둔다. 값을 지어내지 마라.`

/** 모델이 길이를 어겼을 때를 대비해 18개로 맞춘다 */
function toEighteen(arr) {
  const out = Array.from({ length: 18 }, (_, i) => {
    const v = Number(arr?.[i])
    return Number.isFinite(v) ? Math.round(v) : null
  })
  return out
}

/**
 * 스코어카드 사진 한 장을 읽어 구조화된 결과를 돌려준다.
 * 서버 함수와 시험 스크립트가 함께 쓴다.
 */
export async function readScorecard({ image, mediaType, apiKey }) {
  if (typeof image !== 'string' || !image) throw new BadInput('이미지가 없습니다')
  if (!ALLOWED_TYPES.has(mediaType)) throw new BadInput(`지원하지 않는 형식입니다: ${mediaType}`)
  if (image.length * 0.75 > MAX_IMAGE_BYTES) throw new BadInput('사진이 너무 큽니다')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: SCHEMA }, effort: 'medium' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: '이 스코어카드를 읽어 주세요.' },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') throw new BadInput('이 사진은 판독할 수 없습니다')

  const text = response.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('판독 결과가 비어 있습니다')

  const raw = JSON.parse(text)
  const result = {
    course: String(raw.course || '').trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '',
    teeTime: /^\d{1,2}:\d{2}$/.test(raw.teeTime) ? raw.teeTime : '',
    courseFront: String(raw.courseFront || '').trim(),
    courseBack: String(raw.courseBack || '').trim(),
    pars: toEighteen(raw.pars),
    rows: (Array.isArray(raw.rows) ? raw.rows : []).slice(0, 8).map((r) => ({
      label: String(r?.label || '').trim(),
      overs: toEighteen(r?.overs),
      frontTotal: Number.isFinite(r?.frontTotal) ? r.frontTotal : null,
      backTotal: Number.isFinite(r?.backTotal) ? r.backTotal : null,
    })),
  }

  return { result, usage: response.usage }
}

export class BadInput extends Error {}
