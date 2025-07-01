import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
// In production, the compiled code is in .output/server/index.js, so we need to go up 2 levels
const root = isProd ? path.resolve(__dirname, '../..') : path.resolve(__dirname, '../..')

export function getScriptsFromManifest(): string[] {
  const manifestPath = path.resolve(root, '.output/client/.vite/manifest.json')
  
  if (!fs.existsSync(manifestPath)) {
    return []
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  
  // Find the main entry point
  const mainEntry = manifest['src/entry-client.tsx'] || manifest['main']
  if (!mainEntry) return []
  
  const scripts: string[] = []
  
  // Add imports first (dependencies)
  if (mainEntry.imports) {
    mainEntry.imports.forEach((importKey: string) => {
      const chunk = manifest[importKey]
      if (chunk && chunk.file) {
        scripts.push(`/${chunk.file}`)
      }
    })
  }
  
  // Add main entry last
  if (mainEntry.file) {
    scripts.push(`/${mainEntry.file}`)
  }
  
  return scripts
}

export function getStylesFromManifest(): string[] {
  const manifestPath = path.resolve(root, '.output/client/.vite/manifest.json')
  
  if (!fs.existsSync(manifestPath)) {
    return []
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const styles: string[] = []
  
  // Collect all CSS files from the manifest
  Object.values(manifest).forEach((entry: any) => {
    if (entry.css) {
      entry.css.forEach((cssFile: string) => {
        if (!styles.includes(`/${cssFile}`)) {
          styles.push(`/${cssFile}`)
        }
      })
    }
  })
  
  return styles
}