import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the built app works at a domain root (Netlify) and under a
  // subpath (GitHub Pages project sites) without reconfiguring.
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
