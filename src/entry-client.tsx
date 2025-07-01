import { hydrateRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './App.css'

hydrateRoot(
  document.getElementById('root')!,
  <App />
)