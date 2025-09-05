import { createApp, defineEventHandler } from 'h3'
import type { ViteDevServer } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLoggingMiddleware } from './middleware/logging.js'
import { fromNodeMiddleware } from './middleware/static.js'
import { renderSSR } from './ssr/renderer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
// In production, the compiled code is in .output/server/index.js, so we need to go up 2 levels
const root = isProd ? path.resolve(__dirname, '../..') : path.resolve(__dirname, '..')
const enableLogging = process.env.ENABLE_LOGGING === 'true'

export async function createSSRApp() {
  const app = createApp()
  
  // Request logging middleware
  if (enableLogging) {
    app.use(createLoggingMiddleware())
  }
  
  let vite: ViteDevServer | undefined
  
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    })
    app.use(fromNodeMiddleware(vite.middlewares))
  } else {
    const compressionModule = await import('compression')
    const compression = compressionModule.default || compressionModule
    const serveStaticModule = await import('serve-static')
    const serveStatic = serveStaticModule.default || serveStaticModule
    
    app.use(fromNodeMiddleware(compression()))
    app.use(fromNodeMiddleware(serveStatic(path.join(root, '.output/client'), {
      index: false
    })))
  }

  app.use('*', defineEventHandler(async (event) => {
    await renderSSR(event, vite)
  }))
  
  return app
}