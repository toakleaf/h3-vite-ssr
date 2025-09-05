import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

type BrandName = string

function stripQuery(id: string): string {
  const qIndex = id.indexOf('?')
  return qIndex === -1 ? id : id.slice(0, qIndex)
}

function tryGetBrandFromId(id: string): BrandName | undefined {
  const qIndex = id.indexOf('?')
  if (qIndex === -1) return undefined
  const query = new URLSearchParams(id.slice(qIndex + 1))
  const brand = query.get('brand') || query.get('__brand')
  return brand || undefined
}

function normalizeFsPath(p: string): string {
  if (p.startsWith('/@fs/')) return p.slice('/@fs'.length)
  return p
}

function toProjectFsPath(id: string, root: string): string {
  const s = stripQuery(normalizeFsPath(id))
  if (s.startsWith('/src/')) return path.join(root, s.slice(1))
  return s
}

function isInsideSrc(resolvedId: string, root: string): boolean {
  const abs = toProjectFsPath(resolvedId, root)
  const src = path.resolve(root, 'src')
  return abs.startsWith(src + path.sep)
}

function computeOverlayPath(resolvedFile: string, brand: BrandName, root: string): string {
  const idNoQuery = toProjectFsPath(resolvedFile, root)
  const parsed = path.parse(idNoQuery)
  // If the file already lives under a brands/<brand> folder, don't re-add it
  const brandsSegment = path.sep + 'brands' + path.sep + brand + path.sep
  if (parsed.dir.includes(brandsSegment)) return idNoQuery
  return path.join(parsed.dir, 'brands', brand, parsed.base)
}

// Reserved for potential future use
// function appendBrandQuery(id: string, brand: BrandName): string {
//   const q = id.includes('?') ? '&' : '?'
//   return id + `${q}__brand=${encodeURIComponent(brand)}`
// }

function findBrands(srcRoot: string): Set<BrandName> {
  const brandSet = new Set<BrandName>()
  // BFS traversal to find any directory named "brands" under src
  const queue: string[] = [srcRoot]
  while (queue.length) {
    const current = queue.shift() as string
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = path.join(current, entry.name)
      if (entry.name === 'brands') {
        // Immediate children are brand names
        let brandDirs: fs.Dirent[] = []
        try {
          brandDirs = fs.readdirSync(full, { withFileTypes: true })
        } catch {
          brandDirs = []
        }
        for (const b of brandDirs) {
          if (b.isDirectory()) brandSet.add(b.name)
        }
      } else {
        queue.push(full)
      }
    }
  }
  return brandSet
}

export function brandOverrides(): Plugin {
  let config: ResolvedConfig
  let knownBrands = new Set<BrandName>()

  function getBrandForImporter(importer: string | undefined): BrandName | undefined {
    if (!importer) return undefined
    // Only explicit query on importer id (set from entry-client?brand=...)
    const fromQuery = tryGetBrandFromId(importer)
    if (fromQuery) return fromQuery
    return undefined
  }

  return {
    name: 'brand-overrides',
    enforce: 'pre',

    config() {
      // Compute dynamic rollup inputs for client and ssr builds based on discovered brands
      const srcRoot = path.resolve(process.cwd(), 'src')
      const brands = Array.from(findBrands(srcRoot))

      const clientInputs: Record<string, string> = {
        main: '/src/entry-client.tsx'
      }
      for (const b of brands) {
        clientInputs[`brand-${b}`] = `/src/__brand__/${b}/entry-client.ts`
      }

      const ssrInputs: Record<string, string> = {
        'entry-server': '/src/entry-server.tsx'
      }
      for (const b of brands) {
        ssrInputs[`entry-server-${b}`] = `/src/entry-server.tsx?brand=${b}`
      }

      return {
        environments: {
          client: {
            build: {
              rollupOptions: { input: clientInputs }
            }
          },
          ssr: {
            build: {
              rollupOptions: { input: ssrInputs }
            }
          }
        }
      }
    },

    configResolved(resolved) {
      config = resolved
      const srcRoot = path.resolve(config.root, 'src')
      knownBrands = findBrands(srcRoot)
    },

    // Rewrite client entry in dev based on URL ?brand=...
    transformIndexHtml(html: string, ctx?: IndexHtmlTransformContext) {
      if (!ctx || !ctx.originalUrl) return html
      // Only operate in dev server
      if (!ctx.server) return html
      try {
        const url = new URL(ctx.originalUrl, 'http://localhost')
        const brand = url.searchParams.get('brand') || undefined
        if (!brand || !knownBrands.has(brand)) return html
        // Replace the main client entry script to include ?brand
        const pattern = new RegExp('(<script\\s+type=\\"module\\"\\s+src=\\")(/src/entry-client\\.tsx)(\\"\\s*><\\/script>)')
        return html.replace(pattern, `$1$2?brand=${brand}$3`)
      } catch {
        return html
      }
    },

    async resolveId(source, importer, options) {
      // Ensure brand-scoped frontier mapping so brand entries don't include unbranded dynamic imports
      if (source === 'virtual:frontier') {
        const b = getBrandForImporter(importer)
        if (b) {
          const resolved = await this.resolve('virtual:frontier?brand=' + encodeURIComponent(b), importer, { skipSelf: true, ...options })
          if (resolved) return resolved
          return 'virtual:frontier?brand=' + encodeURIComponent(b)
        }
      }
      // Do not intercept virtual modules like 'virtual:frontier';
      // let the dedicated virtual plugin handle them
      // Virtual brand client entries: /src/__brand__/<brand>/entry-client.ts
      const brandEntryMatch = source.match(/^\/src\/__brand__\/([^/]+)\/entry-client\.ts$/)
      if (brandEntryMatch) {
        const b = brandEntryMatch[1]
        if (knownBrands.has(b)) return source
      }
      // If the id itself explicitly carries a brand, record it and let normal resolution happen
      const idBrand = tryGetBrandFromId(source)
      if (idBrand && knownBrands.has(idBrand)) {
        const resolved = await this.resolve(source, importer, { skipSelf: true, ...options })
        if (!resolved) return null
        const idNoQuery = stripQuery(resolved.id)
        if (!idNoQuery.startsWith('\0') && !idNoQuery.startsWith('virtual:') && isInsideSrc(resolved.id, config.root)) {
          return resolved.id + (resolved.id.includes('?') ? '&' : '?') + '__brand=' + encodeURIComponent(idBrand)
        }
        return resolved
      }

      const brand = getBrandForImporter(importer)
      if (!brand || !knownBrands.has(brand)) return null

      // Delegate to default resolution first
      const resolved = await this.resolve(source, importer, { skipSelf: true, ...options })
      if (!resolved) return null

      const resolvedIdNoQuery = stripQuery(resolved.id)
      const isVirtual = resolvedIdNoQuery.startsWith('\0') || resolvedIdNoQuery.startsWith('virtual:')
      if (isVirtual) return resolved

      // Only brand-swap modules under src
      if (!isInsideSrc(resolved.id, config.root)) return resolved

      // Compute overlay path and return it if it exists
      const candidate = computeOverlayPath(resolved.id, brand, config.root)
      if (candidate !== stripQuery(resolved.id) && fs.existsSync(candidate)) {
        const resolvedOverlay = await this.resolve(candidate, importer, { skipSelf: true, ...options })
        if (resolvedOverlay) {
          const idNoQuery = stripQuery(resolvedOverlay.id)
          if (!idNoQuery.startsWith('\0') && !idNoQuery.startsWith('virtual:')) {
            return resolvedOverlay.id + (resolvedOverlay.id.includes('?') ? '&' : '?') + '__brand=' + encodeURIComponent(brand)
          }
          return resolvedOverlay
        }
      }

      // No overlay; propagate brand for downstream imports and keep brand in id for cache separation
      const idNoQuery2 = stripQuery(resolved.id)
      if (!idNoQuery2.startsWith('\0') && !idNoQuery2.startsWith('virtual:')) {
        return resolved.id + (resolved.id.includes('?') ? '&' : '?') + '__brand=' + encodeURIComponent(brand)
      }
      return resolved
    },

    load(id) {
      const brandEntryMatch = id.match(/^\/src\/__brand__\/([^/]+)\/entry-client\.ts$/)
      if (brandEntryMatch) {
        const b = brandEntryMatch[1]
        return `import '/src/entry-client.tsx?brand=${b}'\n`
      }
    },

    handleHotUpdate() {
      // No-op
    }
  }
}


