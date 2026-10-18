import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH serve quando l'app non sta alla radice del dominio (GitHub Pages: /preventivi-chimera/)
export default defineConfig({ base: process.env.BASE_PATH || '/', plugins: [react()] })
