import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: '/src/entry-client.tsx'
      },
      output: {
        format: 'es'
      }
    }
  },
  ssr: {
    target: 'node'
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  }
})