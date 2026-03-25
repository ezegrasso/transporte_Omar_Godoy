# Omar Godoy Transporte

Plataforma web para la gestión operativa y financiera de una empresa de transporte: viajes, camiones, camioneros, facturación, combustible, notificaciones y reportes ejecutivos.

## Demo

- Frontend: https://tu-frontend.vercel.app
- Backend (API): https://tu-backend.onrender.com
- Swagger: https://tu-backend.onrender.com/api-docs


## Vista General

La app centraliza todo el flujo del negocio de transporte:

- Planificación y seguimiento de viajes
- Gestión de camiones y acoplados
- Gestión de usuarios por rol (CEO, Administración, Camionero)
- Facturación, remitos y estado de cobro
- Cargas de combustible y stock de predio
- Adelantos y estadías por camionero
- Panel financiero mensual con tendencia, semáforos de rentabilidad y exportación PDF

## Características Principales

### Operación
- Alta, edición y control de viajes
- Asignación de camioneros y unidades
- Estados de viaje: pendiente, en curso, finalizado
- Observaciones por panel

### Comercial y Facturación
- Gestión de facturas por viaje
- Estados: pendiente, emitida, cobrada, vencida
- Carga de remitos y documentación
- Búsqueda por número de factura y CTG/remitos

### Finanzas
- Dashboard mensual por período
- Ingresos totales, cobrados y pendientes
- Gastos del sistema (sueldos, combustible, comisiones)
- Gastos fijos mensuales configurables
- Utilidad operativa y utilidad neta
- Tendencia de 6 meses (ingresos vs gastos vs utilidad)
- Semáforo de rentabilidad por camionero
- Exportación de reporte financiero PDF

### Seguridad y Acceso
- Autenticación JWT
- Control por roles
- Rutas protegidas en frontend y backend

## Stack Tecnológico

### Frontend
- React + Vite
- Bootstrap + Bootstrap Icons
- Axios
- jsPDF + jspdf-autotable

### Backend
- Node.js + Express
- Sequelize ORM
- MySQL
- Multer (archivos)
- Swagger (documentación)

### DevOps
- GitHub Actions (CI/CD)
- Vercel (frontend)
- Render (backend)

## Arquitectura

```text
Frontend (Vercel)
  -> consume API REST
Backend (Render / Node + Express)
  -> ORM Sequelize
MySQL (Cloud SQL u otro)
```

## Estructura del Repositorio

```text
Backend/
  src/
    config/
    middlewares/
    models/
    routes/
    services/
    server.js
  migrations/
  scripts/

Frontend/
  src/
    components/
    context/
    services/
    utils/
    views/
    App.jsx
```

## Ejecución Local

### Requisitos
- Node.js 18+
- npm 9+
- MySQL 8+

### 1) Backend

```bash
cd Backend
npm install
```

Crear `Backend/.env` con valores como:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=transporte_db
DB_USER=root
DB_PASSWORD=tu_password
PORT=3000
NODE_ENV=development
JWT_SECRET=tu_clave_super_segura
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Iniciar backend:

```bash
npm run dev
```

### 2) Frontend

```bash
cd Frontend
npm install
```

Crear `Frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Iniciar frontend:

```bash
npm run dev
```

App disponible en `http://localhost:5173`.

## Variables de Entorno

### Backend
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `CORS_ORIGIN`

Opcionales según infraestructura:
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_URL`

### Frontend
- `VITE_API_BASE_URL`

## Roles de Usuario

- `ceo`: visión global, operación y finanzas
- `administracion`: operación administrativa y financiera
- `camionero`: gestión de viajes propios

## API y Documentación

Swagger:

- Local: `http://localhost:3000/api-docs`
- Producción: `https://tu-backend.onrender.com/api-docs`

## Deploy

### Frontend (Vercel)
- Conectar repositorio
- Configurar `VITE_API_BASE_URL`
- Deploy automático por push

### Backend (Render)
- Crear Web Service
- Configurar variables de entorno
- Verificar conectividad a MySQL

## Capturas

Agrega imágenes para mostrar la app en GitHub:

```md
![Panel CEO](docs/screenshots/ceo.png)
![Finanzas](docs/screenshots/finanzas.png)
![Administración](docs/screenshots/admin.png)
```

Sugerencia: crea carpeta `docs/screenshots/` y sube capturas reales del sistema.

## Roadmap

- Exportación avanzada de reportes financieros
- Métricas comparativas intermensuales
- Alertas inteligentes por desvíos de margen
- Mejora de observabilidad y auditoría

## Contribución

1. Crear rama feature
2. Implementar cambios
3. Ejecutar build/test local
4. Abrir Pull Request

## Licencia

Define aquí la licencia del proyecto (por ejemplo MIT o privada de la empresa).
