# H3 + Vite SSR

A modern React Server-Side Rendering (SSR) foundation built with [H3](https://github.com/unjs/h3) and [Vite](https://vitejs.dev/). This project provides a clean, production-ready setup with code splitting, CSS modules, and optimized builds.

## ✨ Features

- 🚀 **React 19** with TypeScript
- ⚡ **Vite** for lightning-fast development
- 🔧 **H3** for the server runtime
- 🎯 **Server-Side Rendering** with `renderToPipeableStream`
- 📦 **Code Splitting** - automatic JS and CSS chunking
- 🎨 **CSS Modules** with separate chunks for dynamic components
- 📊 **Request Logging** (toggleable with env var)
- 🏗️ **Modular Architecture** - clean separation of concerns
- 🔄 **Hot Module Replacement** in development
- 📱 **Production Optimized** builds

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Development server (with HMR)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### Optional: Enable Request Logging

```bash
# Development with logging
ENABLE_LOGGING=true pnpm dev

# Production with logging  
ENABLE_LOGGING=true pnpm start
```

## 📁 Project Structure

```
├── src/
│   ├── components/
│   │   ├── DynamicButton.tsx          # Dynamically imported component
│   │   └── DynamicButton.module.css   # CSS module (chunked separately)
│   ├── App.tsx                        # Main React app
│   ├── entry-client.tsx               # Client hydration entry
│   └── entry-server.tsx               # SSR entry
├── server/
│   ├── index.ts                       # Server entry point
│   ├── app.ts                         # App creation & middleware setup
│   ├── middleware/
│   │   ├── logging.ts                 # Request logging middleware
│   │   └── static.ts                  # Node.js → H3 middleware adapter
│   ├── ssr/
│   │   └── renderer.ts                # SSR rendering logic
│   └── utils/
│       └── manifest.ts                # Vite manifest parsing
├── scripts/
│   └── build.ts                       # Production build script
└── index.html                         # HTML template
```

## 🔄 How It Works

### Development Mode (`pnpm dev`)

```mermaid
graph LR
    A[Browser Request] --> B[H3 Server]
    B --> C[Vite Dev Middleware]
    C --> D[Transform HTML]
    D --> E[SSR Render]
    E --> F[Stream HTML + React]
    F --> G[Client Hydration]
    G --> H[HMR Updates]
```

1. **H3 Server** starts on port 3000
2. **Vite middleware** handles asset transformation and HMR
3. **SSR renderer** server-renders React components
4. **HTML streaming** delivers initial content fast
5. **Client hydration** makes the page interactive
6. **Hot Module Replacement** updates code without refresh

### Production Mode (`pnpm build && pnpm start`)

```mermaid
graph LR
    A[Build Process] --> B[Client Bundle]
    A --> C[Server Bundle]
    B --> D[Asset Optimization]
    C --> E[SSR Bundle]
    F[Browser Request] --> G[H3 Server]
    G --> H[Static Assets]
    G --> I[SSR Render]
    I --> J[Optimized HTML]
```

**Build Process:**
1. **Client build** → Optimized JS/CSS chunks in `.output/client/`
2. **Server build** → SSR bundle in `.output/server/`
3. **Asset manifest** → Maps chunks for production loading

**Runtime:**
1. **Static assets** served with compression
2. **SSR rendering** with optimized React bundle
3. **Chunked loading** - React, main app, and dynamic components load separately

## 🏗️ Critical Architecture Pieces

### 1. **Server Structure**

- **`server/index.ts`** - Minimal entry point, starts the server
- **`server/app.ts`** - Core app setup, middleware orchestration
- **`server/ssr/renderer.ts`** - Handles React SSR with streaming
- **`server/middleware/static.ts`** - **Critical adapter** for Node.js middleware

> 🚨 **Why `static.ts` is essential:** H3 uses event-based handlers, but Vite dev server and production static file serving use Node.js middleware. This adapter bridges the gap - without it, nothing works.

### 2. **Entry Points**

- **`src/entry-server.tsx`** - SSR entry, exports `render()` function
- **`src/entry-client.tsx`** - Client hydration entry with CSS imports

### 3. **Code Splitting Magic**

The build automatically creates separate chunks:

```bash
# Production build output
.output/client/assets/
├── react-[hash].js        # React/ReactDOM bundle (11.5kb)
├── main-[hash].js         # Main app code (176kb) 
├── DynamicButton-[hash].js # Dynamic component (0.6kb)
├── main-[hash].css        # Main styles (1.4kb)
└── DynamicButton-[hash].css # Dynamic component styles (0.9kb)
```

### 4. **Manifest Integration**

`server/utils/manifest.ts` reads Vite's build manifest to:
- Load dependencies in correct order (React → Main → Dynamic)
- Inject CSS links for styled components
- Enable proper caching with hashed filenames

## 🎯 Key Commands

| Command | Environment | Description |
|---------|-------------|-------------|
| `pnpm dev` | Development | Vite dev server with SSR + HMR |
| `pnpm dev:log` | Development | Same as above with request logging |
| `pnpm build` | Build | Creates optimized production bundles |
| `pnpm start` | Production | Runs production server from `.output/` |
| `pnpm start:log` | Production | Same as above with request logging |

## 🚦 Production Deployment

The `.output/` directory is completely self-contained:

```bash
# After building
cd .output
pnpm install --prod
PORT=3000 node server/index.js
```

Or use the scripts:
```bash
pnpm build
PORT=8080 pnpm start
```

## 🔧 Configuration

### Environment Variables

- `NODE_ENV=production` - Enables production mode
- `PORT=3000` - Server port (default: 3000)
- `ENABLE_LOGGING=true` - Enables request logging

### Customization

- **Add middleware:** Modify `server/app.ts`
- **Change SSR logic:** Edit `server/ssr/renderer.ts`
- **Adjust build:** Update `scripts/build.ts` or `vite.config.ts`
- **Add routes:** Extend the `*` handler in `server/app.ts`

## 🤔 Why This Stack?

- **H3**: Lightweight, fast, framework-agnostic server
- **Vite**: Superior DX with instant HMR and optimized builds  
- **React 19**: Latest features with improved SSR streaming
- **TypeScript**: Type safety across client and server
- **CSS Modules**: Scoped styles with automatic chunking

This combination provides the performance of custom SSR with the developer experience of modern tooling.

## 📚 Learn More

- [H3 Documentation](https://h3.unjs.io/)
- [Vite SSR Guide](https://vitejs.dev/guide/ssr.html)
- [React 18+ SSR](https://react.dev/reference/react-dom/server)
- [CSS Modules](https://github.com/css-modules/css-modules)

---

Built with ❤️ using modern web technologies