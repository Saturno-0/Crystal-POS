import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, el navegador habla con Vite (:5173) y Vite reenvía /api a la
    // API real (:3001) — así el frontend siempre llama rutas relativas
    // ('/api/...'), igual que en producción cuando la API sirve el build.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
