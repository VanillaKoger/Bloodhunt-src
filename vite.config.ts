import { defineConfig } from 'vite'

export default defineConfig({
  // Relative URLs so a GitHub Pages project site (/bloodhunt/) and a domain root both work.
  base: './',
  server: { host: '0.0.0.0', port: 8734, strictPort: true },
  preview: { host: '0.0.0.0', port: 8734, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
})
