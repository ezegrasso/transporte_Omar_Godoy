# Backend Transporte Omar Godoy

API REST con Node.js, Express, Sequelize y MySQL.

## Variables de entorno (.env)

- DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
- PORT
- JWT_SECRET
- CORS_ORIGIN
- CORS_ALLOW_LAN_5173 (opcional)
- CEO_EMAIL (opcional, credenciales de CEO inicial)
- CEO_PASSWORD (opcional, credenciales de CEO inicial)
- ENABLE_CLAUDE_SONNET_4_5=true|false (flag para habilitar el modelo IA "Claude Sonnet 4.5" en endpoints o servicios internos)
- ANTHROPIC_API_KEY=... (opcional; si está presente y `ENABLE_CLAUDE_SONNET_4_5=true`, se usa proveedor real)
- ANTHROPIC_MODEL_ID=claude-3-5-sonnet-20241022 (opcional; ID del modelo en Anthropic)

## Scripts

- `npm run dev`  Inicia el servidor con nodemon
- `npm start`     Inicia en modo producción

## Autenticación

- POST `/api/auth/login`
  - body: `{ email, password }`
  - retorna: `{ token, usuario }`

Incluye en peticiones protegidas: `Authorization: Bearer <token>`

## Usuarios

- POST `/api/usuarios` (ceo)
  - body: `{ nombre, email, password, rol: 'ceo'|'camionero'|'administracion' }`
- GET `/api/usuarios/me` (autenticado)
- GET `/api/usuarios` (ceo)

## Camiones

- GET `/api/camiones` (autenticado)
- POST `/api/camiones` (ceo)
- PUT `/api/camiones/:id` (ceo)
- DELETE `/api/camiones/:id` (ceo)

## Viajes

- GET `/api/viajes?estado=pendiente` (camionero ve pendientes; ceo/administracion pueden filtrar por estado)
- POST `/api/viajes` (ceo) — body: `{ origen, destino, fecha, camionId }`
- PATCH `/api/viajes/:id/tomar` (camionero)
- PATCH `/api/viajes/:id/finalizar` (camionero) — body: `{ km, combustible }`
- GET `/api/viajes/reporte` (ceo)

## Notas

- Los passwords se guardan con hash (bcrypt).
- Las tablas se sincronizan al iniciar. Usa `alter:true` en `syncModels` (ver `src/config/db.js`).
- Al iniciar, si hay variables `CEO_EMAIL` y `CEO_PASSWORD`, se crea un usuario con rol `ceo` (si no existe ese email). Si no hay `CEO_*`, se usa por defecto `ceo@example.com` / `ceo123`.
- En los logs de arranque verás `Usuario CEO creado (email)` si se creó el usuario inicial.
- El usuario CEO no puede eliminarse y su rol no puede cambiarse (sí se puede editar nombre, email, password y avatar).
- Si `ENABLE_CLAUDE_SONNET_4_5=true`, el servicio interno de IA usará el modelo "Claude Sonnet 4.5" (ver `src/services/aiClient.js`). Si además defines `ANTHROPIC_API_KEY`, utiliza Anthropic de forma real (requiere `npm install anthropic`). Si no hay clave o librería, devuelve respuesta simulada.

## Herramientas CLI

Desde la carpeta `Backend` podés administrar usuarios sin tocar la DB directamente:

- Listar usuarios:
  - `node ./scripts/user-tools.js list-users`
- Crear/actualizar un CEO (si existe, actualiza rol y resetea contraseña):
  - `node ./scripts/user-tools.js create-ceo --email ceo@example.com --password ceo123`
- Crear CEO por defecto (usa CEO_EMAIL/CEO_PASSWORD o ceo@example.com/ceo123):
  - `node ./scripts/user-tools.js create-default-ceo`
- Eliminar todos los usuarios con rol 'admin':
  - `node ./scripts/user-tools.js purge-admins`
- Resetear contraseña de un usuario existente:
  - `node ./scripts/user-tools.js reset-password --email usuario@dominio.com --password nuevaPass`
- Crear usuario genérico (ceo|camionero|administracion):
  - `node ./scripts/user-tools.js create-user --email mail@dominio.com --password pass123 --rol administracion --nombre AdminFinanzas`

### Scripts npm útiles (PowerShell)

```powershell
# Crear usuario de Administración
$env:EMAIL='admin_finanzas@example.com'; $env:PASSWORD='adm12345'; npm run user:create-adm

# Crear camionero adicional
$env:EMAIL='camionero2@example.com'; $env:PASSWORD='camion234'; node ./scripts/user-tools.js create-user --email $env:EMAIL --password $env:PASSWORD --rol camionero --nombre Camionero2
```

Luego inicia sesión con el email creado para acceder a `/administracion`.

## Pruebas rápidas (filtros de viajes)

Se añadió un script que valida el filtrado por rango de fechas en `/api/viajes`.

1. Asegúrate de tener el backend corriendo: `npm run dev`
2. Ejecuta: `npm run test:viajes`

Qué hace:
- Loguea como CEO.
- Crea un camión de prueba y dos viajes en fechas distintas (pasado y futuro).
- Verifica que el rango de un solo día devuelve solo el viaje esperado.
- Verifica que un rango extendido devuelve ambos.

Limitaciones:
- Los viajes y camión de prueba quedan en la base (no hay endpoint de borrado de viajes).
- Usa fechas relativas a la fecha actual; si la zona horaria cambia puede afectar el día. Ajustar si es necesario.

