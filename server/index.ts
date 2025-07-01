import { toNodeListener } from 'h3'
import { createServer } from 'node:http'
import { listen } from 'listhen'
import { createSSRApp } from './app.js'

const isProd = process.env.NODE_ENV === 'production'

export async function startServer() {
  const app = await createSSRApp()
  const port = process.env.PORT || 3000
  
  if (!isProd) {
    await listen(toNodeListener(app), {
      port,
      showURL: true
    })
  } else {
    const server = createServer(toNodeListener(app))
    server.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`)
    })
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
}