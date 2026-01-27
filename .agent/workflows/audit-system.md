---
description: Auditoría completa del sistema de gestión de tickets y reportes.
---

Este flujo ejecuta una batería de pruebas de diagnóstico y genera un reporte consolidado sobre el estado de la aplicación.

1. Ejecutar auditoría definitiva de tickets (SLA, Estados, Asuntos):
// turbo
```powershell
node scripts/auditoria_definitiva.mjs
```

2. Generar reporte detallado de distribución de tickets:
// turbo
```powershell
node scripts/auditoria_total_tickets.mjs
```

3. Verificar visibilidad de sucursales y permisos:
// turbo
```powershell
node scripts/check_sucursales_visibles.mjs
```

4. Realizar diagnóstico exhaustivo de la base de datos:
// turbo
```powershell
node scripts/final_diagnostic.mjs
```
