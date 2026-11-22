/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { serviceWorkerPlugin } from './build/serviceWorkerPlugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorkerPlugin()],
  base: './',
  build: {
    rolldownOptions: {
      output: {
        // Split heavy, rarely-changing vendor code out of the main bundle so it caches well
        // between deployments (the main chunk was ~680 kB).
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
  },
})
