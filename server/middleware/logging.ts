import { defineEventHandler } from 'h3'

export function createLoggingMiddleware() {
  return defineEventHandler((event) => {
    const start = Date.now()
    const method = event.node.req.method
    const url = event.node.req.url
    
    event.node.res.on('finish', () => {
      const duration = Date.now() - start
      const status = event.node.res.statusCode
      const timestamp = new Date().toISOString()
      
      console.log(`[${timestamp}] ${method} ${url} - ${status} (${duration}ms)`)
    })
  })
}