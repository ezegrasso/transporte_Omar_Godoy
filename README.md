# Transporte Omar Godoy — Backend + Frontend

Este repo contiene:
- Backend (Node.js + Express + Sequelize) en `Backend/`
- Frontend (React + Vite) en `Frontend/`

## Requisitos
- Node.js 18+ y npm
- MySQL 8 (local o remoto)

## Configuración
1) Backend (`Backend/.env`)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (obligatorio)
- `JWT_SECRET` (obligatorio)
- `PORT` (por defecto `3000`)
- `CORS_ORIGIN` (lista separada por coma). En desarrollo usar `http://localhost:5173`.

2) Frontend (`Frontend/.env`)
- `VITE_API_BASE_URL` (por defecto `http://localhost:3000`)

## Desarrollo
Abrí dos terminales:

Backend
```
Push-Location "C:\\Users\\Eze\\Desktop\\Transporte Omar Godoy\\Backend"
npm install
npm run dev
```

Frontend
```
Push-Location "C:\\Users\\Eze\\Desktop\\Transporte Omar Godoy\\Frontend"
npm install
npm run dev
```

## CORS
En producción define `CORS_ORIGIN` con los orígenes permitidos. En desarrollo usa `http://localhost:5173` para el Frontend.

## Autenticación
- Inicio de sesión: `POST /api/auth/login` devuelve `{ token, usuario }`.

## Troubleshooting
- Error CORS “Origen no permitido”: ajusta `CORS_ORIGIN` en `Backend/.env`.
- Error de conexión a DB: revisa `DB_*` en `Backend/.env` y credenciales de MySQL.
