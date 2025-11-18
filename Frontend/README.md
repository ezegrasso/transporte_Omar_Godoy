# Frontend (React + Vite)

## Variables de entorno

Copiá `.env.example` a `.env.local` y ajustá los valores:

```
VITE_API_BASE_URL=http://localhost:3000
VITE_NOTIS_AUTO_OPEN_THRESHOLD=3
```

- `VITE_API_BASE_URL`: URL del backend Express.
- `VITE_NOTIS_AUTO_OPEN_THRESHOLD`: número de notificaciones nuevas para auto‑abrir la campana (default 3).

En Windows PowerShell, para probar temporalmente sin archivo `.env.local`:

```powershell
$env:VITE_NOTIS_AUTO_OPEN_THRESHOLD=2; npm run dev
```

Nota: Definir `VITE_NOTIS_AUTO_OPEN_THRESHOLD=2` “sueltito” en PowerShell da error. Debe usarse `$env:` o un archivo `.env.local`.

## Scripts

- `npm run dev`: inicia el servidor de desarrollo.
- `npm run build`: compila para producción.
- `npm run preview`: sirve la build localmente.
