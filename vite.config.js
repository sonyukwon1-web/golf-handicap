import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 로 두면 GitHub Pages(하위 경로), Vercel, 로컬 파일 어디서든 그대로 동작한다.
export default defineConfig({
  plugins: [react()],
  base: './',
})
