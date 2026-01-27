---
description: Sincronización de datos desde WispHub API a la base de datos local.
---

Este flujo permite actualizar la base de datos local con la información más reciente de WispHub (Clientes, Facturas, Tickets).

1. Verificar las llaves de la API:
// turbo
```powershell
node scripts/check_keys.mjs
```

2. Ejecutar sincronización profunda de clientes y sus estados:
// turbo
```powershell
node scripts/test_deep_sync.mjs
```

3. Verificar la integridad de los nuevos tickets:
// turbo
```powershell
node scripts/verify_strict_tickets.mjs
```

4. Limpiar datos huérfanos o inválidos:
// turbo
```powershell
node scripts/test_clean_tickets.mjs
```
