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
- `CORS_ORIGIN` (lista separada por coma). En desarrollo usar `http://localhost:5173` y/o `http://127.0.0.1:5173`. El backend expande automáticamente `localhost`⇄`127.0.0.1` para el mismo puerto.

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
En producción define `CORS_ORIGIN` con los orígenes permitidos. En desarrollo usa `http://localhost:5173` o `http://127.0.0.1:5173` para el Frontend. Si agregás uno, el backend también permitirá el otro para el mismo puerto automáticamente.

## Autenticación
- Inicio de sesión: `POST /api/auth/login` devuelve `{ token, usuario }`.

## Troubleshooting
- “Network Error” al loguear/entrar al panel: suele ser CORS. Asegurate de que `CORS_ORIGIN` contenga el origen exacto (localhost o 127.0.0.1 y puerto). El backend expande `localhost`⇄`127.0.0.1`, pero si usás otra IP (por ejemplo `http://192.168.x.x:5173`) también hay que agregarla.
- Error CORS “Origen no permitido”: ajusta `CORS_ORIGIN` en `Backend/.env`.
- Error de conexión a DB: revisa `DB_*` en `Backend/.env` y credenciales de MySQL.
