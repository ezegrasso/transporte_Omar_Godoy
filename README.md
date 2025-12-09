# Transporte Omar Godoy

App web para gestión integral de transporte, viajes y camiones. Preparada para producción con CI/CD automático.

## 📁 Estructura del Proyecto

```
Transporte Omar Godoy/
├── Backend/                    # API REST (Node.js + Express 5)
│   ├── src/
│   │   ├── server.js          # Punto de entrada
│   │   ├── config/            # DB, Swagger, migrations
│   │   ├── models/            # Sequelize (Usuario, Camion, Viajes)
│   │   ├── routes/            # Endpoints: auth, usuarios, camiones, viajes
│   │   └── middlewares/       # Auth, error handling
│   ├── scripts/               # Backup scripts (shell + PowerShell)
│   ├── migrations/            # Sequelize migrations
│   ├── .env.example           # Template de variables
│   └── package.json           # Deps: express, sequelize, mysql2, multer, etc
│
├── Frontend/                   # React + Vite
│   ├── src/
│   │   ├── components/        # UI, ProtectedRoute, charts
│   │   ├── views/             # Login, Admin, Camionero, Home
│   │   ├── services/          # API client (axios)
│   │   ├── context/           # AuthContext, ToastContext
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json           # Deps: react, vite, axios, bootstrap
│
├── .github/
│   └── workflows/
│       └── ci-deploy.yml      # CI/CD: build + deploy a Vercel + Render
│
├── .gitignore                 # Excluye node_modules, .env, uploads
├── eslint.config.js
└── README.md
```

## 🔧 Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior  
- **MySQL** v8 o superior (local o en la nube)
- **Git** (para clonar y usar CI/CD)

## 🚀 Setup Local (Desarrollo)

### 1. Clona el repositorio
```bash
git clone https://github.com/tu-usuario/transporte-app.git
cd transporte-app
```

### 2. Configura el Backend
```bash
cd Backend
npm install

# Copia el archivo de ejemplo y configura
cp .env.example .env
```

Edita `Backend/.env`:
```env
# Base de Datos
DB_HOST=localhost
DB_PORT=3306
DB_NAME=transporte_db
DB_USER=root
DB_PASSWORD=tu_password_aqui

# Servidor
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_secret_key_super_seguro

# CORS (desarrollo)
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
CORS_ALLOW_LAN_5173=false
```

Inicia el backend:
```bash
npm run dev
```
✅ Backend correrá en `http://localhost:3000`

### 3. Configura el Frontend (otra terminal)
```bash
cd Frontend
npm install

# Copia el archivo de ejemplo
cp .env.example .env
```

Edita `Frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

Inicia el frontend:
```bash
npm run dev
```
✅ Frontend estará en `http://localhost:5173`

### 4. Accede a la aplicación
- Abre en el navegador: `http://localhost:5173`
- Usa las credenciales de un usuario registrado en la BD

## 📋 Configuración de Variables de Entorno

### Backend - `.env.example`

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DB_HOST` | Host de la base de datos | `localhost` |
| `DB_PORT` | Puerto MySQL | `3306` |
| `DB_NAME` | Nombre de la BD | `transporte_db` |
| `DB_USER` | Usuario MySQL | `root` |
| `DB_PASSWORD` | Contraseña | `mipassword123` |
| `PORT` | Puerto del servidor Node | `3000` |
| `NODE_ENV` | Modo (development/production) | `development` |
| `JWT_SECRET` | Clave secreta para tokens | `clave_super_segura_12345` |
| `CORS_ORIGIN` | Orígenes permitidos (comas) | `http://localhost:5173,http://127.0.0.1:5173` |
| `CORS_ALLOW_LAN_5173` | Permite IPs privadas en 5173 | `false` |

### Frontend - `.env.example`

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL base del API Backend | `http://localhost:3000` |

## 🔐 Autenticación

- **Endpoint**: `POST /api/auth/login`
- **Body**: `{ email, password }`
- **Respuesta**: `{ token, usuario: { id, nombre, rol } }`
- **Token**: Se guarda en cookies y contexto de React (`AuthContext`)
- **Roles soportados**: `admin`, `camionero`, `ceo`
- **Protección**: Las rutas protegidas usan el componente `<ProtectedRoute>`

## 🌐 CORS (Compartir Recursos Entre Dominios)

### Desarrollo
- Por defecto acepta: `http://localhost:5173` y `http://127.0.0.1:5173`
- El backend expande automáticamente `localhost` ↔ `127.0.0.1` para el mismo puerto
- Si habilitas `CORS_ALLOW_LAN_5173=true`, también permite IPs privadas de red local en puerto 5173 (útil para probar desde celular con `ngrok` o IP local)

### Producción
- Define `CORS_ORIGIN` con los dominios exactos permitidos (p.ej: `https://miapp.vercel.app,https://api.miapp.com`)

## ⚠️ Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| "Network Error" al loguear | CORS bloqueado | Verifica `CORS_ORIGIN` en `Backend/.env`. Debe incluir la URL completa (protocolo + dominio + puerto). |
| "Origen no permitido" (CORS error) | Backend rechaza la solicitud | Añade el origen a `CORS_ORIGIN` en `Backend/.env` y reinicia el backend. |
| No conecta a la BD | Credenciales incorrectas o BD offline | Revisa `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y que MySQL esté corriendo. |
| Frontend en blanco o no carga | Vite no está corriendo | Ejecuta `npm run dev` en la carpeta `Frontend/`. |
| Puerto 3000 o 5173 ocupado | Otro proceso usa el puerto | Cambia `PORT` en `Backend/.env` o detén el proceso que ocupa el puerto. |
| Migraciones de BD no se ejecutan | Estructura incorrecta | Revisa `Backend/migrations/` y ejecuta `npm run sequelize db:migrate`. |

## 🔄 CI/CD (GitHub Actions)

### Workflow Automático

El archivo `.github/workflows/ci-deploy.yml` ejecuta automáticamente en cada push a `master` o `prod-ready`:

1. **Instala dependencias** del Backend y Frontend
2. **Compila Frontend** (genera build optimizado)
3. **Deploy a Vercel** (si existe secreto `VERCEL_TOKEN`)
4. **Deploy a Render** (si existen `RENDER_API_KEY` y `RENDER_SERVICE_ID`)

### Secretos de GitHub Actions

En `Settings → Secrets and variables → Actions` del repositorio, crear:

| Secreto | Descripción | Requerido | Dónde obtenerlo |
|---------|-------------|-----------|-----------------|
| `VERCEL_TOKEN` | Token personal de Vercel | ✓ si usas Vercel | [Vercel Account Settings](https://vercel.com/account/tokens) |
| `RENDER_API_KEY` | API key de Render | ✓ si usas Render | [Render Account Settings](https://dashboard.render.com/account/api-tokens) |
| `RENDER_SERVICE_ID` | ID del servicio Backend en Render | ✓ si usas Render | URL del servicio en Render dashboard |
| `VITE_API_BASE_URL` | URL del Backend en producción | ✗ (fallback a `http://localhost:3000`) | Tu dominio del Backend |

## 🌍 Despliegue a Producción

### Arquitectura Recomendada

```
Frontend          →  Vercel (auto-deploy desde Git)
Backend           →  Render (auto-deploy por API)
Base de Datos     →  Google Cloud SQL (MySQL)
```

### Pasos de Configuración

#### 1️⃣ Provisionar Base de Datos (Google Cloud SQL)

- Crea una instancia MySQL en [Google Cloud SQL](https://cloud.google.com/sql/docs/mysql/create-instance)
- Anota: `DB_HOST` (IP pública), `DB_PORT` (3306), `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Autoriza acceso de Render: en Cloud SQL → `Connexions` → `Networking` → añade la IP de Render

#### 2️⃣ Deploy Backend en Render

1. Crea un [Web Service](https://dashboard.render.com/services) en Render conectando este repositorio
2. En `Settings → Environment Variables` agrega:
   ```env
   DB_HOST=<tu-cloud-sql-host>
   DB_PORT=3306
   DB_NAME=transporte_db
   DB_USER=<tu-usuario>
   DB_PASSWORD=<tu-password>
   JWT_SECRET=<una-clave-muy-segura>
   CORS_ORIGIN=https://tu-frontend.vercel.app
   NODE_ENV=production
   PORT=10000
   ```
3. En `Settings → Deploy` anota el `RENDER_SERVICE_ID` (parte del URL del servicio)
4. En `Account → API Tokens` copia tu `RENDER_API_KEY`

#### 3️⃣ Deploy Frontend en Vercel

1. Crea un proyecto en [Vercel](https://vercel.com/new) conectando este repositorio
2. En `Settings → Environment Variables` agrega:
   ```env
   VITE_API_BASE_URL=https://tu-backend-render.onrender.com
   ```
3. Vercel auto-desplegará en cada push a `master`

#### 4️⃣ Configurar GitHub Actions (Deploy Automático)

En tu repositorio GitHub, ve a `Settings → Secrets and variables → Actions` y crea:

```bash
VERCEL_TOKEN=<tu-token-vercel>
RENDER_API_KEY=<tu-api-key-render>
RENDER_SERVICE_ID=<tu-service-id-render>
```

Ahora cada push a `master` ejecutará el workflow y desplegará ambas aplicaciones.

### Verificar Deploys

- **Frontend**: Visita `https://tu-app.vercel.app` (mira los deploys en el dashboard de Vercel)
- **Backend**: Visita `https://tu-backend-render.onrender.com/api-docs` (Swagger)
- **Logs**: En Render → `Logs`, en Vercel → `Deployments`

### Configurar Migraciones en Producción

Si necesitas ejecutar migraciones de Sequelize en la BD de producción:

```bash
# En Render, abre una shell SSH o ejecuta:
npm run sequelize db:migrate -- --env production
```

O configúralo en el script de start del `Backend/package.json`:

```json
"start": "npm run sequelize db:migrate && node src/server.js"
```

### Backup de Base de Datos

Usa los scripts en `Backend/scripts/`:

**Linux/Mac:**
```bash
bash Backend/scripts/backup-db.sh
```

**Windows PowerShell:**
```powershell
.\Backend\scripts\backup-db.ps1
```

## 📚 Recursos Adicionales

- [Documentación de Sequelize](https://sequelize.org/)
- [Documentación de Express](https://expressjs.com/)
- [Documentación de Vite](https://vitejs.dev/)
- [Documentación de Vercel](https://vercel.com/docs)
- [Documentación de Render](https://render.com/docs)

## 📝 Licencia

Proyecto privado — uso interno.

## 👨‍💻 Soporte

Si encuentras problemas, revisa la sección **Troubleshooting** o abre un issue en GitHub.
