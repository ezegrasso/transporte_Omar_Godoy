# Migraciones con Sequelize CLI

Este proyecto usa Sequelize para ORM. A partir de ahora, los cambios de esquema deben hacerse con migraciones formales. El archivo `src/config/ensureSchema.js` fue deshabilitado.

## Instalación CLI (una vez en el workspace Backend)

- Instalar dependencias si no lo has hecho desde raíz: `npm install`
- Instalar CLI de desarrollo (recomendado usar el workspace desde la raíz):
  - `npm --workspace Backend i -D sequelize-cli`

## Inicializar estructura (una sola vez)

Esto crea carpetas `migrations/`, `seeders/` y (opcionalmente) `models/` para CLI.

```
npx --workspace Backend sequelize-cli init
```

Si ya tienes modelos en `src/models`, puedes ignorar la carpeta `models/` creada por la CLI y usar solo `migrations/` y `seeders/`.

## Crear migraciones

Ejemplos:

1) Agregar columna `avatarUrl` a `usuarios`:
```
npx --workspace Backend sequelize-cli migration:generate --name add-avatar-url-to-usuarios
```
Contenido sugerido:
- up: `await queryInterface.addColumn('usuarios', 'avatarUrl', { type: Sequelize.STRING, allowNull: true });`
- down: `await queryInterface.removeColumn('usuarios', 'avatarUrl');`

2) Añadir índice único a `camiones.patente` (si no existiese):
```
npx --workspace Backend sequelize-cli migration:generate --name add-unique-index-patente-camiones
```
- up: `await queryInterface.addIndex('camiones', ['patente'], { unique: true, name: 'camiones_patente_unique' });`
- down: `await queryInterface.removeIndex('camiones', 'camiones_patente_unique');`

3) Convertir `viajes.estado` a ENUM (`pendiente`, `en curso`, `finalizado`) en MySQL:
- Para cambiar a ENUM, crea una migración que ejecute `ALTER TABLE` apropiado o recree la columna:
```
await queryInterface.changeColumn('viajes', 'estado', {
  type: Sequelize.ENUM('pendiente', 'en curso', 'finalizado'),
  allowNull: false,
  defaultValue: 'pendiente'
});
```
- Añadir índices:
```
await queryInterface.addIndex('viajes', ['estado'], { name: 'viajes_estado_idx' });
await queryInterface.addIndex('viajes', ['camionId'], { name: 'viajes_camionId_idx' });
await queryInterface.addIndex('viajes', ['camioneroId'], { name: 'viajes_camioneroId_idx' });
```

4) Hacer `usuarios.rol` un ENUM (`admin`, `camionero`):
```
await queryInterface.changeColumn('usuarios', 'rol', {
  type: Sequelize.ENUM('admin', 'camionero'),
  allowNull: false
});
```
- Índices:
```
await queryInterface.addIndex('usuarios', ['email'], { unique: true, name: 'usuarios_email_unique' });
await queryInterface.addIndex('usuarios', ['rol'], { name: 'usuarios_rol_idx' });
```

## Ejecutar / Revertir migraciones

- Ejecutar todas las pendientes:
```
npx --workspace Backend sequelize-cli db:migrate
```

- Revertir la última:
```
npx --workspace Backend sequelize-cli db:migrate:undo
```

- Ver estado:
```
npx --workspace Backend sequelize-cli db:migrate:status
```

## Notas

- Asegúrate de tener configurada la conexión en `Backend/src/config/db.js` y/o `config/config.json` si usas la convención de la CLI.
- En producción, versiona tus migraciones y ejecútalas como parte del pipeline de despliegue.
