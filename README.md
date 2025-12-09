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
En producción define `CORS_ORIGIN` con los orígenes permitidos. En desarrollo usa `http://localhost:5173` o `http://127.0.0.1:5173` para el Frontend. Si agregás uno, el backend también permitirá el otro para el mismo puerto automáticamente. Si activás `CORS_ALLOW_LAN_5173=true`, también se permitirán IPs privadas de red local (192.168.x.x, 10.x.x.x, 172.16–31.x.x) en el puerto 5173 para probar desde el celular.

## Autenticación
- Inicio de sesión: `POST /api/auth/login` devuelve `{ token, usuario }`.

## Troubleshooting
- “Network Error” al loguear/entrar al panel: suele ser CORS. Asegurate de que `CORS_ORIGIN` contenga el origen exacto (localhost o 127.0.0.1 y puerto). El backend expande `localhost`⇄`127.0.0.1`, pero si usás otra IP (por ejemplo `http://192.168.x.x:5173`) también hay que agregarla.
- Error CORS “Origen no permitido”: ajusta `CORS_ORIGIN` en `Backend/.env`.
- Error de conexión a DB: revisa `DB_*` en `Backend/.env` y credenciales de MySQL.

## Despliegue (Vercel / Render / Cloud SQL)

Este repositorio está preparado para desplegar el **Frontend** en **Vercel** y el **Backend** en **Render**, usando **Cloud SQL** (MySQL) como base de datos. A continuación encontrarás los pasos y las variables de entorno necesarias, además del workflow de GitHub Actions que dispara las tareas.

Requisitos previos:
- Crear proyecto en Vercel y/o conectar el repo (opcional: usar Vercel CLI).
- Crear servicio Web en Render y conectar el repo (o habilitar despliegues por API).
- Crear instancia MySQL en Google Cloud SQL (nota: anota host/puerto, nombre BD y credenciales).

Variables de entorno (agregar en Render / Vercel / GitHub Secrets según corresponda):
- `DB_HOST` (host de Cloud SQL)
- `DB_PORT` (por ejemplo `3306`)
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGIN` (orígenes permitidos para Frontend)
- `NODE_ENV=production`

Secrets para GitHub Actions (si querés que el workflow despliegue automáticamente):
- `VERCEL_TOKEN` (token personal de Vercel) — opcional si preferís que Vercel haga deploy directo desde su panel.
- `RENDER_API_KEY` (API key de Render) — para disparar deploys desde Actions.
- `RENDER_SERVICE_ID` (ID del servicio en Render) — usado junto al API key.

Notas sobre conexión Cloud SQL desde Render:
- Render puede conectar a bases externas por host/puerto. Puedes usar la IP pública de Cloud SQL (autorizando la IP de Render) o configurar una IP privada si tu proyecto lo permite. Otra opción es usar el Cloud SQL Auth Proxy en una instancia intermedia, pero lo más sencillo es permitir la IP pública y restringir el acceso mediante usuario/clave.

Cómo funciona el workflow de CI/CD incluido:
- Archivo: `.github/workflows/ci-deploy.yml`
- En push a `master` se ejecuta:
	- `npm ci` en `Backend` y `Frontend`.
	- `npm run build` en `Frontend`.
	- Si existe el secreto `VERCEL_TOKEN`, se intentará desplegar el frontend con `vercel` CLI.
	- Si existen `RENDER_API_KEY` y `RENDER_SERVICE_ID`, Actions enviará una petición a la API de Render para crear un nuevo deploy del servicio (no borra caché si no corresponde).

Pasos recomendados para ponerlo en producción (resumen):
1. Provisionar Cloud SQL (MySQL) y crear la BD/usuario.
2. En Render crear el servicio Backend y en Settings -> Environment > Environment Variables pegar `DB_*`, `JWT_SECRET`, `CORS_ORIGIN`.
3. En Vercel crear el proyecto Frontend (o usar Vercel CLI + `VERCEL_TOKEN`).
4. En GitHub, en `Settings -> Secrets and variables -> Actions` crear `VERCEL_TOKEN` (opcional) y `RENDER_API_KEY` + `RENDER_SERVICE_ID` si querés deploy automático del backend.

Notas finales:
- Si preferís que el deploy del Backend se haga desde Render automáticamente al hacer push (en vez de usar el trigger por API), conecta el repo en Render y habilita auto deploy en la UI de Render.
- Si necesitás que prepare scripts más avanzados (migrations con Sequelize CLI, backup scripts o ejemplo de configuración de `nginx`), dímelo y los agrego.

