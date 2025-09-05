import { hydrateRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import { componentLoaders } from 'virtual:frontier'

async function mount() {
  const root = document.getElementById('root')!
  const componentPath = (root.getAttribute('data-component') || '')
  if (!componentPath) {
    const { default: App } = await import('./App')
    hydrateRoot(root, <App />)
    return
  }
  const loader = componentPath ? (componentLoaders as Record<string, () => Promise<unknown>>)[componentPath] : undefined
  if (!loader) {
    const { default: App } = await import('./App')
    hydrateRoot(root, <App />)
    return
  }
  const mod = (await loader()) as { default?: React.ComponentType; App?: React.ComponentType; Component?: React.ComponentType }
  const Component = (mod.default || mod.App || mod.Component) as React.ComponentType
  hydrateRoot(root, <Component />)
}

mount()