import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '../..')

type FrontierConfig = {
  name: string
  entrypoints: string[]
}

function readFrontierConfig(): FrontierConfig | null {
  const file = path.resolve(root, 'frontier.config.yaml')
  if (!fs.existsSync(file)) return null
  const src = fs.readFileSync(file, 'utf-8')
  const data = YAML.parse(src)
  if (!data || !Array.isArray(data.entrypoints)) return null
  return { name: data.name ?? 'default', entrypoints: data.entrypoints }
}

export function listAvailableEntries(): string[] {
  const config = readFrontierConfig()
  if (!config) return []
  return config.entrypoints.map((p: string) => deriveRouteSegmentFromPath(p)).filter(Boolean)
}

export function resolveEntryNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, 'http://localhost').pathname
    const segments = pathname.split('/').filter(Boolean)
    const entries = listAvailableEntries()
    if (segments.length === 0) {
      // root path → default entry (first configured)
      const config = readFrontierConfig()
      if (config && Array.isArray(config.entrypoints) && config.entrypoints.length > 0) {
        return deriveRouteSegmentFromPath(config.entrypoints[0])
      }
      return ''
    }
    const first = segments[0]
    if (first && entries.includes(first)) return first
    return ''
  } catch {
    return ''
  }
}

export function getClientEntryDevPath(): string {
  return '/src/entry-client.tsx'
}

export function getServerEntryDevPath(): string {
  return '/src/entry-server.tsx'
}

export function getServerEntryProdPath(): string {
  return path.resolve(root, '.output/server/entry-server.js')
}

function normalizeComponentPath(rawPath: string): string {
  let p = rawPath.trim()
  if (!p.startsWith('/')) {
    if (p.startsWith('src/')) {
      p = '/' + p
    } else {
      p = '/src/' + p.replace(/^\.?\/?/, '')
    }
  }
  return p
}

function deriveRouteSegmentFromPath(rawPath: string): string {
  const p = normalizeComponentPath(rawPath)
  // Prefer segment after /src/entries/
  const entriesMatch = p.match(/\/src\/entries\/([^/]+)/)
  if (entriesMatch) return entriesMatch[1]
  // Fallback: first segment after /src/
  const srcMatch = p.replace(/^\/src\//, '')
  const first = srcMatch.split('/').filter(Boolean)[0]
  return first || 'main'
}

export function resolveComponentPathFromUrl(url: string): string | undefined {
  const config = readFrontierConfig()
  if (!config || !Array.isArray(config.entrypoints) || config.entrypoints.length === 0) return undefined
  try {
    const pathname = new URL(url, 'http://localhost').pathname
    const segments = pathname.split('/').filter(Boolean)
    // Root path → default entry: first configured entrypoint
    if (segments.length === 0) {
      return normalizeComponentPath(config.entrypoints[0])
    }
    const first = segments[0]
    for (const raw of config.entrypoints) {
      if (deriveRouteSegmentFromPath(raw) === first) {
        return normalizeComponentPath(raw)
      }
    }
    // Unknown route → undefined (will render Not Found)
    return undefined
  } catch {
    return undefined
  }
}


