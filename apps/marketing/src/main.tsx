import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import HomePage from './pages/HomePage'
import BlogPage from './pages/BlogPage'
import CodexPage from './pages/CodexPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="codex" element={<CodexPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
