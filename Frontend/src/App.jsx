import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { Tooltip } from 'bootstrap'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './views/Login'
import Home from './views/Home'
import Admin from './views/Admin'
import Administracion from './views/Administracion'
import Camionero from './views/Camionero'
import { useAuth } from './context/AuthContext'

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
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
  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary shadow-sm fixed-top">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <img src="/logo.svg" alt="Logo" width="22" height="22" />
          <span className="fw-semibold">Transporte</span>
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><Link className="nav-link" to="/">Inicio</Link></li>
            {!user && <li className="nav-item"><Link className="nav-link" to="/login">Login</Link></li>}
            {user?.rol === 'admin' && <li className="nav-item"><Link className="nav-link" to="/admin">Admin</Link></li>}
            {user?.rol === 'administracion' && <li className="nav-item"><Link className="nav-link" to="/administracion">Administración</Link></li>}
            {user?.rol === 'camionero' && <li className="nav-item"><Link className="nav-link" to="/camionero">Camionero</Link></li>}
          </ul>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-outline-secondary" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Tema">
              <i className={`bi ${theme === 'dark' ? 'bi-moon-stars' : 'bi-sun'}`}></i>
            </button>
            {user && (
              <>
                <button className="btn btn-outline-secondary position-relative" title="Notificaciones">
                  <i className="bi bi-bell"></i>
                  {/* contador opcional */}
                </button>
                <div className="dropdown">
                  <button className="btn btn-outline-secondary d-flex align-items-center gap-2 dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                    <span className="badge rounded-circle bg-primary-subtle text-primary fw-bold" style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {String(user?.nombre || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="d-none d-sm-inline">{user?.nombre || 'Usuario'}</span>
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end">
                    <li className="dropdown-item d-flex align-items-center justify-content-between">
                      <span>Rol</span>
                      <span className={`badge ${user?.rol === 'admin' ? 'badge-role-admin' : user?.rol === 'administracion' ? 'badge-role-administracion' : 'badge-role-camionero'}`}>{user?.rol}</span>
                    </li>
                    <li><hr className="dropdown-divider" /></li>
                    <li>
                      <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => { logout(); navigate('/login') }}>
                        <i className="bi bi-box-arrow-right"></i> Salir
                      </button>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  const location = useLocation()
  const { initializing } = useAuth()
  useEffect(() => {
    const base = 'Transporte'
    const map = {
      '/': 'Inicio',
      '/login': 'Login',
      '/admin': 'Admin',
      '/camionero': 'Camionero',
      '/administracion': 'Administración'
    }
    const match = Object.keys(map).find(k => location.pathname.startsWith(k)) || '/'
    document.title = `${map[match]} — ${base}`
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
    <div className="container py-4 max-w-6xl mx-auto app-content">
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={
          <ProtectedRoute roles={["admin"]}>
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/administracion" element={
          <ProtectedRoute roles={["administracion"]}>
            <Administracion />
          </ProtectedRoute>
        } />
        <Route path="/camionero" element={
          <ProtectedRoute roles={["camionero"]}>
            <Camionero />
          </ProtectedRoute>
        } />
      </Routes>
    </div>
  )
}
