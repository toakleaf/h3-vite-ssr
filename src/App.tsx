import { useState, Suspense, lazy } from 'react'
import { OverloadButton } from './components/OverloadButton'
import { NothingSpecial } from './components/NothingSpecial'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

const DynamicButton = lazy(() => import('./components/DynamicButton'))

function App() {
  const [count, setCount] = useState(0)
  const [showDynamic, setShowDynamic] = useState(false)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
        <button onClick={() => setShowDynamic(!showDynamic)} style={{ marginTop: '1rem' }}>
          {showDynamic ? 'Hide' : 'Load'} Dynamic Component
        </button>
      </div>
      
      <OverloadButton />
      
      {showDynamic && (
        <Suspense fallback={<div>Loading dynamic component...</div>}>
          <DynamicButton />
        </Suspense>
      )}
      
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <NothingSpecial />
    </>
  )
}

export default App
