/**
 * 기기끼리 기록을 맞추는 자리 — **문서 한 장을 주고받는다.**
 *
 * ══════════════════════════════════════════════════════════════════
 * 넷이 쓰는 앱이라 거창한 것이 필요 없다. 방 이름 하나에 JSON 한 덩어리를
 * 얹어 두고, 열면 받아 오고 바뀌면 올린다. 늦게 올린 쪽이 이긴다
 * (updatedAt 비교는 클라이언트가 한다).
 *
 * 저장소는 **Vercel KV / Upstash Redis 의 REST 창구**를 그대로 쓴다. SDK 를
 * 안 붙이는 까닭은 의존성을 하나라도 덜 늘리려는 것이고, 두 서비스가 같은
 * 창구를 쓰기 때문이다.
 *
 * 환경변수가 없으면 **503 을 내고 앱은 지금까지처럼 이 기기에만 담는다** —
 * 켜지 않았다고 앱이 멈추면 안 된다.
 * ══════════════════════════════════════════════════════════════════
 */
const ROOM = /^[a-z0-9]{4,32}$/i
const MAX_BYTES = 900 * 1024   // Upstash 무료 한도(1MB)에 여유를 둔다

/**
 * 저장소 주소와 열쇠를 찾는다.
 *
 * **이름을 못 박지 않는다.** Vercel 에서 저장소를 붙일 때 접두어를 붙일 수
 * 있어(`kv_KV_REST_API_URL` 꼴), 이름을 하나로 정해 두면 대시보드에서 뭘
 * 골랐느냐에 따라 조용히 못 찾는다. 끝이 맞는 것을 찾아 쓴다.
 *
 * READ_ONLY 토큰은 거른다 — 그것으로는 쓸 수가 없다.
 */
const store = () => {
  const find = (suffix, deny) =>
    Object.entries(process.env).find(
      ([k, v]) => v && k.toUpperCase().endsWith(suffix) && !(deny && k.toUpperCase().includes(deny)),
    )?.[1]

  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || find('REST_API_URL'),
    token:
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      find('REST_API_TOKEN', 'READ_ONLY'),
  }
}

export default async function handler(req, res) {
  const { url, token } = store()
  if (!url || !token) {
    return res.status(503).json({ error: '동기화 저장소가 아직 연결되지 않았습니다.' })
  }

  const room = String(req.query.room || '')
  if (!ROOM.test(room)) return res.status(400).json({ error: '연결 코드가 올바르지 않습니다.' })

  const key = `nakwon:room:${room.toLowerCase()}`
  const auth = { Authorization: `Bearer ${token}` }

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: auth })
      const j = await r.json()
      /* 없는 방은 빈 문서다 — 처음 켠 기기가 그대로 올리면 그것이 시작이 된다 */
      return res.status(200).json(j?.result ? JSON.parse(j.result) : null)
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
      if (body.length > MAX_BYTES) {
        return res.status(413).json({ error: '자료가 너무 큽니다. 사진을 몇 장 지워 주세요.' })
      }
      const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'text/plain' },
        body,
      })
      if (!r.ok) throw new Error(`저장소 오류 ${r.status}`)
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'GET 이나 POST 만 받습니다.' })
  } catch (e) {
    return res.status(502).json({ error: `동기화에 실패했습니다: ${e.message}` })
  }
}
