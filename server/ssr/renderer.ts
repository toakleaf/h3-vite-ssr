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
      // Load the server entry with brand when provided so SSR imports resolve with brand overrides
      let devServerEntry = getServerEntryDevPath()
      try {
        const b = new URL(url, 'http://localhost').searchParams.get('brand')
        if (b) devServerEntry = devServerEntry + `?brand=${b}`
      } catch {}
      const mod = await vite.ssrLoadModule(devServerEntry)
      render = (mod as { renderWithComponent: SSRRenderFn }).renderWithComponent
    } else {
      // Build a minimal template ourselves; we will inject the right client asset below
      template = '<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head><body><!--app-html--></body></html>'
      const urlObj = new URL(url, 'http://localhost')
      const brand = urlObj.searchParams.get('brand') || undefined
      // Select brand-specific server entry
      // entry-server.js (default) or entry-server-purple.js
      let serverEntry = getServerEntryProdPath()
      if (brand) {
        const candidate = serverEntry.replace(/entry-server\.js$/, `entry-server-${brand}.js`)
        if (fs.existsSync(candidate)) serverEntry = candidate
      }
      const mod = await import(serverEntry)
      render = (mod as { renderWithComponent: SSRRenderFn }).renderWithComponent
    }
    
    const htmlStart = template.substring(0, template.indexOf('<!--app-html-->'))
    const htmlEnd = template.substring(template.indexOf('<!--app-html-->') + '<!--app-html-->'.length)
    
    event.node.res.setHeader('Content-Type', 'text/html')
    event.node.res.write(htmlStart)
    
    // In production, we inject the correct client entry script (main or brand)

    // Choose component module path based on URL and frontier.config.yaml
    const componentModulePath = resolveComponentPathFromUrl(url)
    // If brand query is present, append to component path so brand-specific loader is chosen
    let componentKey = componentModulePath
    try {
      const u = new URL(url, 'http://localhost')
      const brand = u.searchParams.get('brand')
      if (componentKey && brand) componentKey = componentKey + `?brand=${brand}`
    } catch {}
    const dataAttr = componentKey ? ` data-component="${componentKey}"` : ''
    event.node.res.write(`<div id="root"${dataAttr}>`)
    
    const app = await render(componentKey)
    
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
            if (isProd) {
              const urlObj = new URL(url, 'http://localhost')
              const brand = urlObj.searchParams.get('brand') || undefined
              const manifestPath = path.resolve(root, '.output/client/.vite/manifest.json')
              let scriptSrc = '/assets/main.js'
              const cssSet = new Set<string>()
              try {
                type ManEntry = { file: string; css?: string[]; imports?: string[]; dynamicImports?: string[]; assets?: string[] }
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<string, ManEntry>
                // Find key by suffix to tolerate relative prefixes Vite writes in manifest
                function findEntryKey(): string | undefined {
                  if (brand) {
                    const suffix = `src/__brand__/${brand}/entry-client.ts`
                    return Object.keys(manifest).find((k) => k.endsWith(suffix))
                  }
                  const defaultSuffixes = ['src/entry-client.tsx', '/src/entry-client.tsx']
                  return Object.keys(manifest).find((k) => defaultSuffixes.some((s) => k.endsWith(s)))
                }
                const entryKey = findEntryKey()
                const entry = entryKey ? manifest[entryKey] : undefined
                if (entry && entry.file) scriptSrc = '/' + entry.file.replace(/^\/?/, '')
                // Collect CSS from entry and its static imports recursively (exclude dynamicImports)
                const visited = new Set<string>()
                const queue: string[] = []
                if (entryKey) queue.push(entryKey)
                while (queue.length) {
                  const key = queue.shift() as string
                  if (visited.has(key)) continue
                  visited.add(key)
                  const m = manifest[key]
                  if (!m) continue
                  if (Array.isArray(m.css)) {
                    for (const href of m.css) cssSet.add('/' + href.replace(/^\/?/, ''))
                  }
                  const deps = Array.isArray(m.imports) ? m.imports : []
                  for (const dep of deps) if (!visited.has(dep)) queue.push(dep)
                }
              } catch {}
              for (const href of cssSet) event.node.res.write(`<link rel="stylesheet" href="${href}"/>`)
              event.node.res.write(`<script type="module" src="${scriptSrc}"></script>`)
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
    
  } catch (error: unknown) {
    if (!isProd && vite) {
      vite.ssrFixStacktrace?.(error as Error)
    }
    console.error(error)
    event.node.res.statusCode = 500
    event.node.res.end(error instanceof Error ? error.message : 'Internal Server Error')
  }
}