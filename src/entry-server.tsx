import React from 'react'
import './index.css'
import './App.css'
import { componentLoaders, type ComponentPath } from 'virtual:frontier'

export async function renderWithComponent(componentModulePath?: string) {
  if (!componentModulePath) {
    const { default: App } = await import('./App')
    return React.createElement(App)
  }
  const loader = (componentLoaders as Record<ComponentPath, () => Promise<unknown>>)[componentModulePath as ComponentPath]
  if (!loader) {
    const { default: App } = await import('./App')
    return React.createElement(App)
  }
  const mod = (await loader()) as { default?: React.ComponentType; App?: React.ComponentType; Component?: React.ComponentType }
  const Component = (mod.default || mod.App || mod.Component) as React.ComponentType
  return React.createElement(Component)
}