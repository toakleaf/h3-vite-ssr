import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  // Essential: Enables JSX transformation and React Fast Refresh
  plugins: [react()],
  
  build: {
    // Critical: Creates manifest.json for production asset mapping
    manifest: true,
    rollupOptions: {
      // Specifies client entry point (server uses separate build in scripts/build.ts)
      input: {
        main: '/src/entry-client.tsx'
      }
    }
  },
  
  // Optimizes SSR bundle for Node.js environment
  ssr: {
    target: 'node'
  },
  
  // Pre-bundles React for faster dev server startup
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})