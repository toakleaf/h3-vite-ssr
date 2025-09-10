import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
import { getFrontierEntrypoints } from './plugins/get-frontier-entrypoints'
import { brandOverrides } from './plugins/brand-overrides'


export default defineConfig(({ mode }) => {
  if (mode === 'server-runtime') {
    return {
      plugins: [react()],
      build: {
        outDir: '.output/server',
        emptyOutDir: false,
        ssr: true,
        lib: {
          entry: path.resolve(__dirname, 'server/index.ts'),
          formats: ['es'],
          fileName: 'index'
        },
        rollupOptions: {
          external: [],
          output: { format: 'esm' }
        },
        minify: false
      },
      ssr: { target: 'node' }
    }
  }
  return {
    plugins: [brandOverrides(), react(), getFrontierEntrypoints()],
    optimizeDeps: {
      include: ['react', 'react-dom']
    },
    ssr: { target: 'node' },
    environments: {
      client: {
        build: {
          outDir: '.output/client',
          manifest: true,
          ssrManifest: true,
        }
      },
      ssr: {
        build: {
          outDir: '.output/server',
          ssr: true,
        }
      }
    }
  }
})