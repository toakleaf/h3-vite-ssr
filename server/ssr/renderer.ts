import { renderToPipeableStream } from 'react-dom/server'
import { H3Event } from 'h3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getScriptsFromManifest, getStylesFromManifest } from '../utils/manifest.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
// In production, the compiled code is in .output/server/index.js, so we need to go up 2 levels
const root = isProd ? path.resolve(__dirname, '../..') : path.resolve(__dirname, '../..')

export async function renderSSR(event: H3Event, vite?: any) {
  const url = event.node.req.url!
  
  try {
    let template: string
    let render: any
    
    if (!isProd) {
      template = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render
    } else {
      template = fs.readFileSync(path.resolve(root, '.output/client/index.html'), 'utf-8')
      render = (await import(path.resolve(root, '.output/server/entry-server.js'))).render
    }
    
    const scripts = isProd ? getScriptsFromManifest() : []
    const styles = isProd ? getStylesFromManifest() : []
    
    const htmlStart = template.substring(0, template.indexOf('<!--app-html-->'))
    const htmlEnd = template.substring(template.indexOf('<!--app-html-->') + '<!--app-html-->'.length)
    
    event.node.res.setHeader('Content-Type', 'text/html')
    event.node.res.write(htmlStart)
    
    if (isProd) {
      styles.forEach(style => {
        event.node.res.write(`<link rel="stylesheet" href="${style}">`)
      })
    }
    
    event.node.res.write('<div id="root">')
    
    const app = await render(url)
    
    await new Promise<void>((resolve, reject) => {
      const { pipe, abort } = renderToPipeableStream(
        app,
        {
          onShellReady() {
            pipe(event.node.res )
          },
          onShellError(error) {
            reject(error)
          },
          onAllReady() {
            event.node.res.write('</div>')
            if (!isProd) {
              event.node.res.write('<script type="module" src="/@vite/client"></script>')
              event.node.res.write('<script type="module" src="/src/entry-client.tsx"></script>')
            } else {
              scripts.forEach(script => {
                event.node.res.write(`<script type="module" src="${script}"></script>`)
              })
            }
            event.node.res.end(htmlEnd)
            resolve()
          },
          onError(error) {
            console.error(error)
          }
        }
      )
      
      event.node.req.on('close', () => {
        abort()
      })
    })
    
  } catch (e: any) {
    if (!isProd) {
      vite.ssrFixStacktrace(e)
    }
    console.error(e)
    event.node.res.statusCode = 500
    event.node.res.end(e.message)
  }
}