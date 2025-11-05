import { useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './views/Login'
import Admin from './views/Admin'
import Camionero from './views/Camionero'
import { useAuth } from './context/AuthContext'

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  useEffect(() => {
    localStorage.setItem('theme', theme)
    const root = document.documentElement
    root.dataset.bsTheme = theme
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
  }, [theme])
  return (
    <nav className="navbar navbar-expand-lg bg-body-tertiary shadow-sm">
      <div className="container">
        <Link className="navbar-brand" to="/">Transporte</Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarSupportedContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item"><Link className="nav-link" to="/">Inicio</Link></li>
            {!user && <li className="nav-item"><Link className="nav-link" to="/login">Login</Link></li>}
            {user?.rol === 'admin' && <li className="nav-item"><Link className="nav-link" to="/admin">Admin</Link></li>}
            {user?.rol === 'camionero' && <li className="nav-item"><Link className="nav-link" to="/camionero">Camionero</Link></li>}
          </ul>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-outline-secondary" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Tema">
              <i className={`bi ${theme === 'dark' ? 'bi-moon-stars' : 'bi-sun'}`}></i>
            </button>
            {user && (
              <button className="btn btn-outline-danger" onClick={() => { logout(); navigate('/login') }} title="Salir">
                <i className="bi bi-box-arrow-right me-1"></i> Salir
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <div className="container py-4 max-w-6xl mx-auto">
      <NavBar />
      <Routes>
        <Route path="/" element={<div>Bienvenido</div>} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={
          <ProtectedRoute roles={["admin"]}>
            <Admin />
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
