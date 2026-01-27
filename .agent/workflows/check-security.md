---
description: Auditoría de seguridad de Supabase y políticas RLS.
---

Este flujo permite verificar que la base de datos sea segura y que no haya vulnerabilidades de acceso.

1. Listar el estado de seguridad y avisos de la DB:
> [!TIP]
> Usa las herramientas mcp de Supabase para obtener avisos de seguridad.

// turbo
```powershell
node scripts/audit_depts.mjs
```

2. Ejecutar diagnósticos de seguridad con herramientas de Supabase:
> [!NOTE]
> Revisa si hay políticas de RLS faltantes en tablas críticas.

3. Validar permisos de roles específicos:
// turbo
```powershell
node scripts/check_sucursales_visibles.mjs
```
