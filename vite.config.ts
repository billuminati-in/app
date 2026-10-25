import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH is the folder the app is served from: "/app/" on GitHub Pages, "/" on a custom domain.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
