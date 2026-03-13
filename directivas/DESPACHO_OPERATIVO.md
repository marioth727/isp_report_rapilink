# SOP: Centro de Despacho (Operaciones Visuales)
> **ID:** DIRECTIVA-DESPACHO-001
> **Fuente:** `docs/wisphub_technical_memory.md` (Sección 6, 8 y 9)

## 1. Objetivo
Mantener la integridad visual y funcional del tablero de despacho (`OperationsDispatch.tsx`).

## 2. Reglas de Oro (Visual vs Data)
> [!CRITICAL]
> **Despacho Manual Estricto:** La visualización del tablero está **DESACOPLADA** de la base de datos.
> - **Inicio:** Las columnas de técnicos deben cargar VACÍAS (o desde `localStorage`).
> - **Prohibido:** Hacer merge de `WorkflowService.getTodayAssignments()` en el `useEffect` de carga.

## 3. Procedimiento de Implementación

### Caso A: Drag & Drop
1.  **Identidad:** Usar `draggableId` (ID del ticket), NUNCA el índice del array (`source.index`).
2.  **Datos Filtrados:** Si hay filtros activos, buscar el objeto en `filteredTickets`, no en `tickets`.

### Caso B: Reset Visual
1.  Si se necesita limpiar "fantasmas" o caché corrupto:
2.  Cambiar la clave de almacenamiento en `OperationsDispatch.tsx` (ej: de `_v1` a `_v2`).

## 4. Scripts de Verificación
- `scripts/check_dispatch_logs.mjs` (Verificar consistencia)
- `scripts/check_autoassign_db.mjs` (Verificar que el backend no está auto-asignando si no debe)
