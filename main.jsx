import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Aplica tema inicial antes de renderizar para evitar parpadeo de tema
const initialTheme = localStorage.getItem('theme') || 'light'
document.documentElement.dataset.bsTheme = initialTheme
if (initialTheme === 'dark') document.documentElement.classList.add('dark');
else document.documentElement.classList.remove('dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
