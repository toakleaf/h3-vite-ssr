import type { IndexHtmlTransformContext, Plugin, ResolvedConfig, ViteDevServer } from 'vite'
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

function isStyleFile(id: string): boolean {
  const p = stripQuery(id).toLowerCase()
  return p.endsWith('.css') || p.endsWith('.less') || p.endsWith('.scss') || p.endsWith('.sass') || p.endsWith('.styl')
}

function isCssModuleFile(id: string): boolean {
  const p = stripQuery(id).toLowerCase()
  return p.includes('.module.') && isStyleFile(p)
}

function computeBasePathFromOverlay(resolvedFile: string, brand: BrandName, root: string): string | undefined {
  const abs = toProjectFsPath(resolvedFile, root)
  const parsed = path.parse(abs)
  const brandsSegment = path.sep + 'brands' + path.sep + brand
  if (!parsed.dir.includes(brandsSegment + path.sep)) return undefined
  const dirWithoutBrand = parsed.dir.replace(brandsSegment, '')
  return path.join(dirWithoutBrand, parsed.base)
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
  // Caches
  const pathExistsCache = new Map<string, boolean>()
  const brandsCacheBySrcRoot = new Map<string, Set<BrandName>>()

  function cachedFindBrands(srcRoot: string): Set<BrandName> {
    const cached = brandsCacheBySrcRoot.get(srcRoot)
    if (cached) return new Set(cached)
    const found = findBrands(srcRoot)
    brandsCacheBySrcRoot.set(srcRoot, new Set(found))
    return new Set(found)
  }

  function invalidateAllCaches(): void {
    pathExistsCache.clear()
    brandsCacheBySrcRoot.clear()
  }

  function pathExistsCached(p: string): boolean {
    const cached = pathExistsCache.get(p)
    if (cached !== undefined) return cached
    const exists = fs.existsSync(p)
    pathExistsCache.set(p, exists)
    return exists
  }

  function getBrandForImporter(importer: string | undefined): BrandName | undefined {
    if (!importer) return undefined
    // 1) explicit query on importer id (entry-client?brand=...)
    const fromQuery = tryGetBrandFromId(importer)
    if (fromQuery) return fromQuery
    // 2) infer from path segment /brands/<brand>/ for overlay importers
    const importerPath = stripQuery(normalizeFsPath(importer))
    for (const b of knownBrands) {
      const seg = path.sep + 'brands' + path.sep + b + path.sep
      if (importerPath.includes(seg)) return b
    }
    return undefined
  }

  return {
    name: 'brand-overrides',
    enforce: 'pre',

    config() {
      // Compute dynamic rollup inputs for client and ssr builds based on discovered brands
      const srcRoot = path.resolve(process.cwd(), 'src')
      const brands = Array.from(cachedFindBrands(srcRoot))

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
      knownBrands = cachedFindBrands(srcRoot)
    },

    configureServer(server: ViteDevServer) {
      const srcRoot = path.resolve(server.config.root, 'src')
      const isUnderSrc = (p: string) => {
        const abs = path.isAbsolute(p) ? p : path.resolve(server.config.root, p)
        return abs === srcRoot || abs.startsWith(srcRoot + path.sep)
      }
      const maybeInvalidate = (p: string) => {
        if (!isUnderSrc(p)) return
        const abs = path.isAbsolute(p) ? p : path.resolve(server.config.root, p)
        const brandsSeg = path.sep + 'brands' + path.sep
        if (!abs.includes(brandsSeg)) return
        // Clear all caches; simple and safe. Recompute known brands.
        invalidateAllCaches()
        knownBrands = cachedFindBrands(srcRoot)
      }
      server.watcher.on('add', maybeInvalidate)
      server.watcher.on('change', maybeInvalidate)
      server.watcher.on('unlink', maybeInvalidate)
      server.watcher.on('addDir', maybeInvalidate)
      server.watcher.on('unlinkDir', maybeInvalidate)
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

      // Skip if we already injected a style bridge guard
      if (source.includes('__brand_injected=1')) return null
      // Do not intercept virtual modules like 'virtual:frontier';
      // let the dedicated virtual plugin handle them
      // Virtual brand client entries: /src/__brand__/<brand>/entry-client.ts
      const brandEntryMatch = source.match(/^\/src\/__brand__\/([^/]+)\/entry-client\.ts$/)
      if (brandEntryMatch) {
        const b = brandEntryMatch[1]
        if (knownBrands.has(b)) return source
      }
      // Determine brand from explicit query on the import or from importer context
      const explicitBrand = tryGetBrandFromId(source)
      const brand = (explicitBrand && knownBrands.has(explicitBrand)) ? explicitBrand : getBrandForImporter(importer)
      if (!brand || !knownBrands.has(brand)) return null

      // Delegate to default resolution first
      const resolved = await this.resolve(source, importer, { skipSelf: true, ...options })
      if (!resolved) return null

      const resolvedIdNoQuery = stripQuery(resolved.id)
      const isVirtual = resolvedIdNoQuery.startsWith('\0') || resolvedIdNoQuery.startsWith('virtual:')
      if (isVirtual) return resolved

      // Only brand-swap modules under src
      if (!isInsideSrc(resolved.id, config.root)) return resolved

      // Compute overlay path
      const candidate = computeOverlayPath(resolved.id, brand, config.root)
      if (pathExistsCached(candidate)) {
        // Two cases for additive styles:
        // 1) Import currently resolves to base style and overlay exists → bridge(base, overlay)
        // 2) Import currently resolves to overlay style (already under /brands/<brand>/) → bridge(base-from-overlay, overlay)
        if (isStyleFile(resolved.id)) {
          // Case 2: already overlay
          if (candidate === stripQuery(toProjectFsPath(resolved.id, config.root))) {
            const basePath = computeBasePathFromOverlay(resolved.id, brand, config.root)
            if (basePath && pathExistsCached(basePath)) {
              const resolvedOverlay = await this.resolve(resolved.id, importer, { skipSelf: true, ...options })
              const resolvedBase = await this.resolve(basePath, importer, { skipSelf: true, ...options })
              if (resolvedOverlay && resolvedBase) {
                const isModule = isCssModuleFile(resolved.id)
                const bridgeId = `\0brand-style-bridge?base=${encodeURIComponent(resolvedBase.id)}&overlay=${encodeURIComponent(resolvedOverlay.id)}&kind=${isModule ? 'module' : 'plain'}`
                return bridgeId
              }
            }
          } else {
            // Case 1: base resolves, overlay exists
            const resolvedOverlay = await this.resolve(candidate, importer, { skipSelf: true, ...options })
            if (resolvedOverlay) {
              const isModule = isCssModuleFile(resolved.id)
              const bridgeId = `\0brand-style-bridge?base=${encodeURIComponent(resolved.id)}&overlay=${encodeURIComponent(resolvedOverlay.id)}&kind=${isModule ? 'module' : 'plain'}`
              return bridgeId
            }
          }
        }
        // Non-style: just swap to overlay
        const resolvedOverlayNonStyle = await this.resolve(candidate, importer, { skipSelf: true, ...options })
        if (resolvedOverlayNonStyle) return resolvedOverlayNonStyle.id
      }

      // No overlay; keep resolved as-is
      return resolved
    },

    load(id) {
      const brandEntryMatch = id.match(/^\/src\/__brand__\/([^/]+)\/entry-client\.ts$/)
      if (brandEntryMatch) {
        const b = brandEntryMatch[1]
        return `import '/src/entry-client.tsx?brand=${b}'\n`
      }
      if (id.startsWith('\0brand-style-bridge?')) {
        const q = id.indexOf('?')
        const sp = new URLSearchParams(id.slice(q + 1))
        const base = sp.get('base') || ''
        const overlay = sp.get('overlay') || ''
        const kind = sp.get('kind') || 'plain'
        const baseImp = base + (base.includes('?') ? '&' : '?') + '__brand_injected=1'
        const overlayImp = overlay + (overlay.includes('?') ? '&' : '?') + '__brand_injected=1'
        if (kind === 'module') {
          const baseUsed = baseImp + (baseImp.includes('&') ? '&' : '?') + 'used'
          const overlayUsed = overlayImp + (overlayImp.includes('&') ? '&' : '?') + 'used'
          return `import baseStyles from '${baseUsed}'\nimport overlayStyles from '${overlayUsed}'\nconst merged = { ...baseStyles }\nfor (const k in overlayStyles) {\n  const baseVal = merged[k]\n  const overVal = overlayStyles[k]\n  merged[k] = baseVal ? (baseVal + ' ' + overVal) : overVal\n}\nexport default merged\n`
        }
        const baseUsed = baseImp + (baseImp.includes('&') ? '&' : '?') + 'used'
        const overlayUsed = overlayImp + (overlayImp.includes('&') ? '&' : '?') + 'used'
        return `import '${baseUsed}'\nimport '${overlayUsed}'\n`
      }
    },

    handleHotUpdate() {
      // No-op
    }
  }
}


