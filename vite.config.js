import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': BACKEND_URL,
      '/ws': { target: BACKEND_URL, ws: true }
    }
  }
})
