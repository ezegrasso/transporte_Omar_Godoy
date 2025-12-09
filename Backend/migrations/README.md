Sequelize migrations

Este directorio contiene las migraciones gestionadas por `sequelize-cli`.

Cómo generar una nueva migración (desde la raíz del proyecto):

```bash
cd Backend
npx sequelize-cli migration:generate --name create_users_table
```

Luego edita la migración generada y aplícala:

```bash
npm run migrate
```

Si prefieres usar `sequelize.sync()` el proyecto ya incluye `ensureSchema.js` que crea tablas automáticamente en arranque, pero las migraciones son recomendadas en producción.
