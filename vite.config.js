import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages project sites the app is served from
// https://<user>.github.io/<repo>/ , so assets must be resolved from that
// sub-path. Override with the VITE_BASE env var (the deploy workflow sets it
// to the repository name automatically).
const base = process.env.VITE_BASE ?? '/govmap-demo/'

// https://vite.dev/config/
export default defineConfig({
  base,
  server: {
    allowedHosts: ['tzahi-test.com']
  },
  plugins: [react()],
})
