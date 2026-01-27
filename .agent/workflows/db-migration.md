---
description: Aplicación de migraciones SQL a Supabase de forma segura.
---

Este flujo guía el proceso de aplicación de cambios en el esquema de la base de datos.

1. Verificar conexión y estructura actual de la DB:
// turbo
```powershell
node scripts/check_db.mjs
```

2. Revisar el archivo de migración que se desea aplicar (Ejemplo: `scripts/supabase_migration_workflow.sql`):
```powershell
Get-Content scripts/supabase_migration_workflow.sql
```

3. Aplicar los cambios mediante la herramienta de Supabase (Mesa de control):
> [!IMPORTANT]
> Debes copiar el contenido del archivo SQL y ejecutarlo en el editor de SQL de Supabase.

4. Verificar que los cambios se aplicaron correctamente (Ejemplo: Nuevos menús o permisos):
// turbo
```powershell
node scripts/audit_depts.mjs
```
