import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to https://fitsexpress.com/scsoperations/
// The trailing slash matters — without it Vite emits relative paths that
// break on deep links.
export default defineConfig({
  base: '/scsoperations/',
  plugins: [react()],
})
