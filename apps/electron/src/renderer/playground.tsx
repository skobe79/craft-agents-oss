import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider as JotaiProvider } from 'jotai'
import { ThemeProvider } from './context/ThemeContext'
import { PlaygroundApp } from './playground/PlaygroundApp'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <JotaiProvider>
      <ThemeProvider>
        <PlaygroundApp />
      </ThemeProvider>
    </JotaiProvider>
  </React.StrictMode>
)
