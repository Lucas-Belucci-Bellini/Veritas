import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installNativeSmokeTrigger } from './simulation/nativeSmoke'
import './index.css'

installNativeSmokeTrigger()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
