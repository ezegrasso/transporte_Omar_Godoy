import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'

const Login = lazy(() => import('./views/Login'))
const Home = lazy(() => import('./views/Home'))
const Ceo = lazy(() => import('./views/Ceo'))
const Graficos = lazy(() => import('./views/Graficos'))
const GraficosAdministracion = lazy(() => import('./views/GraficosAdministracion'))
const Administracion = lazy(() => import('./views/Administracion'))
const Camionero = lazy(() => import('./views/Camionero'))
const Finanzas = lazy(() => import('./views/Finanzas'))

function NavBar() {
  const { user } = useAuth()
  const location = useLocation()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [navOpen, setNavOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(min-width: 992px)').matches
  })
  useEffect(() => {
    localStorage.setItem('theme', theme)
    const root = document.documentElement
    root.dataset.bsTheme = theme
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
  }, [theme])
  useEffect(() => {
    // Cerrar el menú colapsable al cambiar de ruta
    setNavOpen(false)
  }, [location.pathname])
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 992px)')
    const onChange = (e) => {
      setIsDesktop(e.matches)
      if (e.matches) setNavOpen(false)
    }

    setIsDesktop(mql.matches)

    if (mql.addEventListener) {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }

    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [])
  useEffect(() => {
    const nav = document.querySelector('.navbar.fixed-top')
    if (!nav) return
    const update = () => {
      const rawHeight = Math.ceil(nav.offsetHeight || nav.getBoundingClientRect().height || 72)
      const clampedHeight = Math.min(Math.max(rawHeight, 56), 220)
      document.documentElement.style.setProperty('--app-navbar-offset', `${clampedHeight}px`)
    }
    requestAnimationFrame(update)
  }, [navOpen, location.pathname, isDesktop])

  const navbarContentClass = isDesktop
    ? 'navbar-collapse app-navbar-collapse d-flex align-items-lg-center'
    : `collapse navbar-collapse app-navbar-collapse align-items-lg-center ${navOpen ? 'show' : ''}`

  const closeNavIfMobile = () => {
    if (!isDesktop) setNavOpen(false)
  }
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
          className={navbarContentClass}
        >
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><Link className="nav-link" to="/" onClick={closeNavIfMobile}>Inicio</Link></li>
            {!user && <li className="nav-item"><Link className="nav-link" to="/login" onClick={closeNavIfMobile}>Login</Link></li>}
            {user?.rol === 'ceo' && (location.pathname === '/ceo' || location.pathname === '/graficos' || location.pathname === '/finanzas') && (
              <li className="nav-item"><Link className="nav-link" to="/ceo" onClick={closeNavIfMobile}>Panel CEO</Link></li>
            )}
            {user?.rol === 'ceo' && (location.pathname === '/ceo' || location.pathname === '/graficos' || location.pathname === '/finanzas') && (
              <li className="nav-item"><Link className="nav-link" to="/graficos" onClick={closeNavIfMobile}>Gráficos</Link></li>
            )}
            {user?.rol === 'ceo' && (location.pathname === '/ceo' || location.pathname === '/graficos' || location.pathname === '/finanzas') && (
              <li className="nav-item"><Link className="nav-link" to="/finanzas" onClick={closeNavIfMobile}>Finanzas</Link></li>
            )}
            {user?.rol === 'ceo' && location.pathname === '/administracion' && (
              <li className="nav-item"><Link className="nav-link" to="/administracion" onClick={closeNavIfMobile}>Administración</Link></li>
            )}
            {user?.rol === 'administracion' && <li className="nav-item"><Link className="nav-link" to="/administracion" onClick={closeNavIfMobile}>Panel Administración</Link></li>}
            {user?.rol === 'administracion' && (location.pathname === '/administracion' || location.pathname === '/administracion/graficos' || location.pathname === '/finanzas') && (
              <li className="nav-item"><Link className="nav-link" to="/administracion/graficos" onClick={closeNavIfMobile}>Gráficos</Link></li>
            )}
            {user?.rol === 'administracion' && (location.pathname === '/administracion' || location.pathname === '/administracion/graficos' || location.pathname === '/finanzas') && (
              <li className="nav-item"><Link className="nav-link" to="/finanzas" onClick={closeNavIfMobile}>Finanzas</Link></li>
            )}
            {user?.rol === 'camionero' && <li className="nav-item"><Link className="nav-link" to="/camionero" onClick={closeNavIfMobile}>Mis Viajes</Link></li>}
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
        const rawHeight = Math.ceil(nav.offsetHeight || nav.getBoundingClientRect().height || 72)
        const h = Math.min(Math.max(rawHeight, 56), 220)
        document.documentElement.style.setProperty(
          '--app-navbar-offset',
          `${h}px`
        )
      }
    }

    updateOffset()

    window.addEventListener('resize', updateOffset)

    const collapseEl = document.getElementById('navbarSupportedContent')

    const onShown = () => updateOffset()
    const onHidden = () => updateOffset()

    if (collapseEl) {
      collapseEl.addEventListener('shown.bs.collapse', onShown)
      collapseEl.addEventListener('hidden.bs.collapse', onHidden)
    }

    return () => {
      window.removeEventListener('resize', updateOffset)

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
      '/graficos': 'Gráficos',
      '/finanzas': 'Finanzas',
      '/camionero': 'Camionero',
      '/administracion': 'Administración',
      '/administracion/graficos': 'Gráficos Administración'
    }
    const match = Object.keys(map).find(k => location.pathname.startsWith(k)) || '/'
    document.title = `${map[match]} — ${base}`
    // Recalcular el offset también al cambiar de ruta (por si varía la altura)
    const nav = document.querySelector('.navbar.fixed-top')
    if (nav) {
      const rawHeight = Math.ceil(nav.offsetHeight || nav.getBoundingClientRect().height || 72)
      const h = Math.min(Math.max(rawHeight, 56), 220)
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
            <Route path="/graficos" element={
              <ProtectedRoute roles={["ceo"]}>
                <ErrorBoundary fallback={<div className="mt-2">Se produjo un error en Gráficos.</div>}>
                  <Graficos />
                </ErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/administracion/graficos" element={
              <ProtectedRoute roles={["administracion"]}>
                <ErrorBoundary fallback={<div className="mt-2">Se produjo un error en Gráficos.</div>}>
                  <GraficosAdministracion />
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
            <Route path="/finanzas" element={
              <ProtectedRoute roles={["ceo", "administracion"]}>
                <ErrorBoundary fallback={<div className="mt-2">Se produjo un error en Finanzas.</div>}>
                  <Finanzas />
                </ErrorBoundary>
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </div>
    </>
  )
}
