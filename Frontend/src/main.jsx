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

// Parche de desarrollo: evitar que errores al convertir objetos a string
// dentro de console.error rompan toda la vista ("Cannot convert object to primitive value").
// Sanitiza los argumentos antes de loguearlos.
if (import.meta.env.DEV) {
  const originalError = console.error
  console.error = (...args) => {
    try {
      const safeArgs = args.map((arg) => {
        if (arg instanceof Error) return arg
        try {
          // Intentar conversión a string; si falla, devolver marcador seguro
          // sin volver a lanzar error.
          // eslint-disable-next-line no-implicit-coercion
          const s = '' + arg
          return s
        } catch {
          return '[valor de error no stringificable]'
        }
      })
      originalError(...safeArgs)
    } catch {
      // Como último recurso, evitar que falle el logger.
      originalError('Error interno al loguear con console.error')
    }
  }
}

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
