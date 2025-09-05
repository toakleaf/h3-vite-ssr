/// <reference types="vite/client" />
declare module 'virtual:frontier' {
  export const componentLoaders: Record<string, () => Promise<unknown>>
  export type ComponentPath = keyof typeof componentLoaders
}
