import { defineEventHandler } from 'h3'

/**
 * Adapter to convert Node.js-style middleware to h3 event handlers.
 * 
 * This is CRITICAL for the SSR setup because:
 * 
 * 1. **Vite dev server**: Vite only provides Node.js middleware (req, res, next), 
 *    but h3 uses event-based handlers. Without this adapter, the dev server 
 *    won't work at all.
 * 
 * 2. **Production static files**: Libraries like `serve-static` and `compression` 
 *    are Node.js middleware. h3 doesn't have equivalent built-ins, so we need 
 *    this adapter to serve assets and enable gzip compression.
 * 
 * 3. **No alternatives**: There's no h3-native version of Vite's dev middleware,
 *    and rewriting these would be significant work for little benefit.
 * 
 * @param middleware - Any Node.js middleware function with signature (req, res, next)
 * @returns h3 event handler that can be used with app.use()
 * 
 * @example
 * ```ts
 * // Convert Vite dev middleware
 * app.use(fromNodeMiddleware(vite.middlewares))
 * 
 * // Convert compression middleware  
 * app.use(fromNodeMiddleware(compression()))
 * 
 * // Convert static file middleware
 * app.use(fromNodeMiddleware(serveStatic('./public')))
 * ```
 */
export function fromNodeMiddleware(middleware: any) {
  return defineEventHandler(async (event) => {
    await new Promise<void>((resolve, reject) => {
      middleware(event.node.req, event.node.res, (err: any) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
}