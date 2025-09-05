import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

export function getFrontierEntrypoints(): Plugin {
  return {
    name: 'get-frontier-entrypoints',
    resolveId(id: string) {
      if (id === 'virtual:frontier') return '\0virtual:frontier'
    },
    load(this, id) {
      if (id !== '\0virtual:frontier') return
      const cfg = path.resolve(process.cwd(), 'frontier.config.yaml')
      this.addWatchFile(cfg)
      let entrypoints: string[] = []
      if (fs.existsSync(cfg)) {
        const parsed = YAML.parse(fs.readFileSync(cfg, 'utf-8')) || {}
        if (Array.isArray(parsed.entrypoints)) entrypoints = parsed.entrypoints
      }
      function normalize(p: unknown) {
        let s = (typeof p === 'string' ? p : '').trim().replace(/\\/g, '/')
        if (!s.startsWith('/')) s = s.startsWith('src/') ? '/' + s : '/src/' + s.replace(/^\.?\/?/, '')
        return s
      }
      const imports = entrypoints.map(normalize)
      // Discover brands under src
      function findBrands(srcRoot: string): string[] {
        const brandSet = new Set<string>()
        const queue: string[] = [srcRoot]
        while (queue.length) {
          const current = queue.shift() as string
          let items: fs.Dirent[] = []
          try {
            items = fs.readdirSync(current, { withFileTypes: true })
          } catch {
            continue
          }
          for (const dirent of items) {
            if (!dirent.isDirectory()) continue
            if (dirent.name === 'node_modules' || dirent.name.startsWith('.')) continue
            const full = path.join(current, dirent.name)
            if (dirent.name === 'brands') {
              let sub: fs.Dirent[] = []
              try {
                sub = fs.readdirSync(full, { withFileTypes: true })
              } catch {
                sub = []
              }
              for (const b of sub) if (b.isDirectory()) brandSet.add(b.name)
            } else {
              queue.push(full)
            }
          }
        }
        return Array.from(brandSet)
      }

      const srcRoot = path.resolve(process.cwd(), 'src')
      const brands = findBrands(srcRoot)

      const pairs: Array<[string, string]> = []
      for (const p of imports) {
        // Unbranded
        pairs.push([p, p])
        // Branded variants
        for (const b of brands) {
          const key = p + `?brand=${b}`
          const spec = p + `?brand=${b}`
          pairs.push([key, spec])
        }
      }

      const entries = pairs.map(([key, spec]) => {
        return "  '" + key + "': () => import('" + spec + "')"
      }).join(',\n')
      const body = 'export const componentLoaders = {\n' + entries + '\n}\n'
      return body
    }
  }
}


