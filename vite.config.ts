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
          rollupOptions: {
            input: {
              main: '/src/entry-client.tsx',
              // brand-specific client entries (virtual)
              'brand-purple': '/src/__brand__/purple/entry-client.ts'
            }
          }
        }
      },
      ssr: {
        build: {
          outDir: '.output/server',
          ssr: true,
          rollupOptions: {
            // Also build separate SSR entries per brand for static import resolution
            input: {
              'entry-server': '/src/entry-server.tsx',
              'entry-server-purple': '/src/entry-server.tsx?brand=purple'
            }
          }
        }
      }
    }
  }
})