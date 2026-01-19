import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { Tooltip } from 'bootstrap'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'

const Login = lazy(() => import('./views/Login'))
const Home = lazy(() => import('./views/Home'))
const Ceo = lazy(() => import('./views/Ceo'))
const Administracion = lazy(() => import('./views/Administracion'))
const Camionero = lazy(() => import('./views/Camionero'))

function NavBar() {
  const { user } = useAuth()
  const location = useLocation()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => {
    localStorage.setItem('theme', theme)
    const root = document.documentElement
    root.dataset.bsTheme = theme
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
  }, [theme])
  useEffect(() => {
    // Inicializar tooltips de Bootstrap al cambiar de ruta
    const nodes = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    const tips = nodes.map(n => new Tooltip(n))
    return () => tips.forEach(t => t.dispose())
  }, [location.pathname])
  useEffect(() => {
    // Cerrar el menú colapsable al cambiar de ruta
    setNavOpen(false)
  }, [location.pathname])
  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary shadow-sm fixed-top">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <img src="/logo.svg" alt="Logo Omar Godoy" width="32" height="32" />
          <div className="d-flex flex-column lh-sm">
            <span className="fw-bold text-primary" style={{ fontSize: '1.1rem' }}>OMAR GODOY</span>
            <span className="text-body-secondary small" style={{ marginTop: '-2px' }}>Transporte</span>
          </div>
        </Link>
        <div className="d-flex align-items-center ms-auto gap-2">
          <button
            className="btn btn-outline-secondary d-lg-none"
            type="button"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="Tema"
          >
            <i className={`bi ${theme === 'dark' ? 'bi-moon-stars' : 'bi-sun'}`}></i>
          </button>
          <button
            className="navbar-toggler d-lg-none"
            type="button"
            aria-controls="navbarSupportedContent"
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen(o => !o)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>
        <div
          id="navbarSupportedContent"
          className={`flex-grow-1 ${navOpen ? 'd-block' : 'd-none'} d-lg-flex align-items-lg-center`}
        >
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><Link className="nav-link" to="/">Inicio</Link></li>
            {!user && <li className="nav-item"><Link className="nav-link" to="/login">Login</Link></li>}
            {user?.rol === 'ceo' && (
              <>
                <li className="nav-item"><Link className="nav-link" to="/ceo">Panel CEO</Link></li>
                <li className="nav-item"><Link className="nav-link" to="/administracion">Administración</Link></li>
              </>
            )}
            {user?.rol === 'administracion' && <li className="nav-item"><Link className="nav-link" to="/administracion">Panel Administración</Link></li>}
            {user?.rol === 'camionero' && <li className="nav-item"><Link className="nav-link" to="/camionero">Mis Viajes</Link></li>}
          </ul>
          <div className="d-none d-lg-flex align-items-center gap-2 flex-nowrap ms-lg-auto">
            <button className="btn btn-outline-secondary" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Tema">
              <i className={`bi ${theme === 'dark' ? 'bi-moon-stars' : 'bi-sun'}`}></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const location = useLocation()
  const { initializing } = useAuth()
  // Ajusta dinámicamente el offset del contenido según la altura real del navbar fijo
  useEffect(() => {
    const updateOffset = () => {
      const nav = document.querySelector('.navbar.fixed-top')
      if (nav) {
        const h = Math.ceil(nav.getBoundingClientRect().height)
        document.documentElement.style.setProperty('--app-navbar-offset', `${h}px`)
      }
    }

    // Inicial
    updateOffset()

    // Recalcular en resize de ventana
    window.addEventListener('resize', updateOffset)

    // Recalcular cuando cambia la altura del navbar (apertura/cierre del colapsable)
    const nav = document.querySelector('.navbar.fixed-top')
    let ro
    if (nav && 'ResizeObserver' in window) {
      ro = new ResizeObserver(() => updateOffset())
      ro.observe(nav)
    }

    // Escuchar eventos de Bootstrap del colapsable si existen
    const collapseEl = document.getElementById('navbarSupportedContent')
    const onShown = () => updateOffset()
    const onHidden = () => updateOffset()
    if (collapseEl) {
      collapseEl.addEventListener('shown.bs.collapse', onShown)
      collapseEl.addEventListener('hidden.bs.collapse', onHidden)
    }

    return () => {
      window.removeEventListener('resize', updateOffset)
      if (ro) ro.disconnect()
      if (collapseEl) {
        collapseEl.removeEventListener('shown.bs.collapse', onShown)
        collapseEl.removeEventListener('hidden.bs.collapse', onHidden)
      }
    }
  }, [])
  useEffect(() => {
    const base = 'Omar Godoy Transporte'
    const map = {
      '/': 'Inicio',
      '/login': 'Login',
      '/ceo': 'CEO',
      '/camionero': 'Camionero',
      '/administracion': 'Administración'
    }
    const match = Object.keys(map).find(k => location.pathname.startsWith(k)) || '/'
    document.title = `${map[match]} — ${base}`
    // Recalcular el offset también al cambiar de ruta (por si varía la altura)
    const nav = document.querySelector('.navbar.fixed-top')
    if (nav) {
      const h = Math.ceil(nav.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--app-navbar-offset', `${h}px`)
    }
  }, [location.pathname])

  if (initializing) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-2 text-body-secondary">Preparando la aplicación…</p>
      </div>
    )
  }

  return (
    <>
      <NavBar />
      <div className="container pt-3 pb-4 max-w-6xl mx-auto app-content">
        <Suspense fallback={<div className="spinner-border"><p>Cargando...</p></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/ceo" element={
              <ProtectedRoute roles={["ceo"]}>
                <ErrorBoundary fallback={<div className="mt-2">Se produjo un error en el panel CEO.</div>}>
                  <Ceo />
                </ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/administracion" element={
              <ProtectedRoute roles={["administracion"]}>
                <ErrorBoundary fallback={<div className="mt-2">Intenta recargar la página o revisar filtros.</div>}>
                  <Administracion />
                </ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/camionero" element={
              <ProtectedRoute roles={["camionero"]}>
                <ErrorBoundary fallback={<div className="mt-2">Se produjo un error en Mis Viajes.</div>}>
                  <Camionero />
                </ErrorBoundary>
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </div>
    </>
  )
}
