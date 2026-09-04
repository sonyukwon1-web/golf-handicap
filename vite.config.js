import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 개발 서버에도 판독 API 를 붙인다.
 *
 * 배포된 곳에서는 Vercel 이 `api/` 아래 파일을 함수로 띄우지만, `npm run dev` 는
 * 정적 파일만 낸다. 그러면 로컬에서 사진 인식을 확인할 수 없어서, 같은 핸들러를
 * 개발 서버에 그대로 물린다.
 */
function localApi(env) {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use('/api/ocr', async (req, res) => {
        if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY

        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        try {
          req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        } catch {
          req.body = {}
        }

        // Vercel 함수가 기대하는 모양을 흉내 낸다
        res.status = (code) => { res.statusCode = code; return res }
        res.json = (data) => {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(data))
        }

        const { default: handler } = await import('./api/ocr.js')
        await handler(req, res)
      })
    },
  }
}

// base: './' 로 두면 어떤 경로에 올려도 그대로 동작한다.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), localApi(env)], base: './' }
})
