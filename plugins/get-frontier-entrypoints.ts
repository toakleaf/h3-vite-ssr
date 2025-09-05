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
        let s = (typeof p === 'string' ? p : '').trim().replace(/\\\\/g, '/')
        if (!s.startsWith('/')) s = s.startsWith('src/') ? '/' + s : '/src/' + s.replace(/^\.?\/?/, '')
        return s
      }
      const imports = entrypoints.map(normalize)
      const entries = imports.map((p) => {
        return "  '" + p + "': () => import('" + p + "')"
      }).join(',\n')
      const body = 'export const componentLoaders = {\n' + entries + '\n}\n'
      return body
    }
  }
}


