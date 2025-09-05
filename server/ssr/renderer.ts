import { renderToPipeableStream } from 'react-dom/server'
import { H3Event } from 'h3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveComponentPathFromUrl, getServerEntryDevPath, getServerEntryProdPath } from '../utils/entries.js'
import type { ViteDevServer } from 'vite'
import type { ReactElement } from 'react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
const root = path.resolve(__dirname, '../..')

type SSRRenderFn = (componentModulePath?: string) => ReactElement
export async function renderSSR(event: H3Event, vite?: ViteDevServer) {
  const url = event.node.req.url!
  
  try {
    let template: string
    let render: SSRRenderFn
    
    if (!isProd) {
      if (!vite) throw new Error('Vite dev server not provided')
      template = fs.readFileSync(path.resolve(root, 'index.html'), 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      // Use Vite's ssrLoadModule in dev for reliability
      const mod = await vite.ssrLoadModule(getServerEntryDevPath())
      render = (mod as { renderWithComponent: SSRRenderFn }).renderWithComponent
    } else {
      // Use built client template with correct asset links
      template = fs.readFileSync(path.resolve(root, '.output/client/index.html'), 'utf-8')
      const mod = await import(getServerEntryProdPath())
      render = (mod as { renderWithComponent: SSRRenderFn }).renderWithComponent
    }
    
    const htmlStart = template.substring(0, template.indexOf('<!--app-html-->'))
    const htmlEnd = template.substring(template.indexOf('<!--app-html-->') + '<!--app-html-->'.length)
    
    event.node.res.setHeader('Content-Type', 'text/html')
    event.node.res.write(htmlStart)
    
    // In production, CSS and JS are already referenced by the built template

    // Choose component module path based on URL and frontier.config.yaml
    const componentModulePath = resolveComponentPathFromUrl(url)
    const dataAttr = componentModulePath ? ` data-component="${componentModulePath}"` : ''
    event.node.res.write(`<div id="root"${dataAttr}>`)
    
    const app = await render(componentModulePath)
    
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
    
  } catch (error: unknown) {
    if (!isProd && vite) {
      vite.ssrFixStacktrace?.(error as Error)
    }
    console.error(error)
    event.node.res.statusCode = 500
    event.node.res.end(error instanceof Error ? error.message : 'Internal Server Error')
  }
}