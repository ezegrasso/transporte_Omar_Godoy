import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Parche: evitar que errores al convertir objetos a string
// dentro de console.error rompan toda la vista ("Cannot convert object to primitive value").
// También silenciar errores removeChild causados por extensiones del navegador.
// Sanitiza los argumentos antes de loguearlos.
const originalError = console.error
console.error = (...args) => {
  try {
    // Filtrar errores conocidos causados por extensiones del navegador
    const errorStr = args.join(' ')
    if (errorStr.includes('removeChild') && errorStr.includes('NotFoundError')) {
      // Silenciar error removeChild causado por extensiones del navegador
      return
    }
    if (errorStr.includes('The node to be removed is not a child')) {
      // Silenciar variantes del mismo error
      return
    }

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

// Aplica tema inicial antes de renderizar para evitar parpadeo de tema
const initialTheme = localStorage.getItem('theme') || 'light'
document.documentElement.dataset.bsTheme = initialTheme
if (initialTheme === 'dark') document.documentElement.classList.add('dark');
else document.documentElement.classList.remove('dark')

createRoot(document.getElementById('root')).render(
  <ErrorBoundary fallback={<div className="container mt-5"><div className="alert alert-warning">Error al cargar la aplicación. Intenta recargar la página.</div></div>}>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>,
)
