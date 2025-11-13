# Backend Transporte Omar Godoy

API REST con Node.js, Express, Sequelize y MySQL.

## Variables de entorno (.env)

- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
- PORT
- JWT_SECRET
- CORS_ORIGIN
- ADMIN_EMAIL (opcional)
- ADMIN_PASSWORD (opcional)

## Scripts

- `npm run dev`  Inicia el servidor con nodemon
- `npm start`     Inicia en modo producción

## Autenticación

- POST `/api/auth/login`
  - body: `{ email, password }`
  - retorna: `{ token, usuario }`

Incluye en peticiones protegidas: `Authorization: Bearer <token>`

## Usuarios

- POST `/api/usuarios` (admin)
  - body: `{ nombre, email, password, rol: 'admin'|'camionero' }`
- GET `/api/usuarios/me` (autenticado)
- GET `/api/usuarios` (admin)

## Camiones

- GET `/api/camiones` (autenticado)
- POST `/api/camiones` (admin)
- PUT `/api/camiones/:id` (admin)
- DELETE `/api/camiones/:id` (admin)

## Viajes

- GET `/api/viajes?estado=pendiente` (camionero ve pendientes; admin puede filtrar por estado)
- POST `/api/viajes` (admin) — body: `{ origen, destino, fecha, camionId }`
- PATCH `/api/viajes/:id/tomar` (camionero)
- PATCH `/api/viajes/:id/finalizar` (camionero) — body: `{ km, combustible }`
- GET `/api/viajes/reporte` (admin)

## Notas

- Los passwords se guardan con hash (bcrypt).
- Las tablas se sincronizan al iniciar. Usa `alter:true` en `syncModels` (ver `src/config/db.js`).
- Se crea un usuario admin al iniciar si `ADMIN_EMAIL` y `ADMIN_PASSWORD` están definidos.
