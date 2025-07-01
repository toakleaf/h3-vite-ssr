import { build } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

async function buildApp() {
  // Clean output directory
  fs.rmSync(path.join(root, '.output'), { recursive: true, force: true })
  
  // Build client
  await build({
    configFile: path.join(root, 'vite.config.ts'),
    build: {
      outDir: '.output/client',
      manifest: true,
      ssrManifest: true,
      rollupOptions: {
        output: {
          format: 'es',
          manualChunks: {
            react: ['react', 'react-dom']
          }
        }
      }
    }
  })
  
  // Build server
  await build({
    configFile: path.join(root, 'vite.config.ts'),
    build: {
      outDir: '.output/server',
      ssr: 'src/entry-server.tsx',
      rollupOptions: {
        output: {
          format: 'esm'
        }
      }
    }
  })
  
  // Build server entry
  await build({
    configFile: false,
    build: {
      outDir: '.output/server',
      emptyOutDir: false,  // Don't empty the output directory
      lib: {
        entry: path.join(root, 'server/index.ts'),
        formats: ['es'],
        fileName: 'index'
      },
      rollupOptions: {
        external: ['h3', 'vite', 'react', 'react-dom', 'react-dom/server', 'listhen', 'compression', 'serve-static', 'node:http', 'node:fs', 'node:path', 'node:url']
      },
      minify: false,
      ssr: true
    },
    resolve: {
      conditions: ['node']
    }
  })
  
  // Copy index.html to output
  fs.copyFileSync(
    path.join(root, 'index.html'),
    path.join(root, '.output/client/index.html')
  )
  
  // Create minimal package.json for production
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  const prodPkg = {
    name: pkg.name,
    type: 'module',
    dependencies: {
      'h3': pkg.dependencies['h3'],
      'listhen': pkg.dependencies['listhen'],
      'react': pkg.dependencies['react'],
      'react-dom': pkg.dependencies['react-dom'],
      'compression': pkg.dependencies['compression'],
      'serve-static': pkg.dependencies['serve-static']
    }
  }
  fs.writeFileSync(path.join(root, '.output/package.json'), JSON.stringify(prodPkg, null, 2))
  
  console.log('Build complete!')
}

buildApp().catch(console.error)