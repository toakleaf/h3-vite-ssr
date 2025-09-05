import React from 'react'
import './index.css'
import './App.css'
import { componentLoaders, type ComponentPath } from 'virtual:frontier'

export async function renderWithComponent(componentModulePath?: string) {
  if (!componentModulePath) {
    return React.createElement('div', null, 'Not Found')
  }
  const loader = (componentLoaders as Record<ComponentPath, () => Promise<unknown>>)[componentModulePath as ComponentPath]
  if (!loader) {
    return React.createElement('div', null, 'Not Found')
  }
  const mod = (await loader()) as { default?: React.ComponentType; App?: React.ComponentType; Component?: React.ComponentType }
  const Component = (mod.default || mod.App || mod.Component) as React.ComponentType
  return React.createElement(Component)
}