# SOP: Integración y Sincronización WispHub
> **ID:** DIRECTIVA-WISPHUB-001
> **Referencia Crítica:** `docs/wisphub_technical_memory.md`

## 1. El Mandamiento Principial
**ANTES** de tocar cualquier código relacionado con WispHub (`src/lib/wisphub.ts`, `WorkflowService.ts`), **DEBES** leer la Memoria Técnica:
👉 `docs/wisphub_technical_memory.md`

## 2. Por qué es Crítico
Ese documento contiene "Sangre, Sudor y Lágrimas" de bugs pasados:
- La lógica de los 5 minutos de desfase horario.
- El campo oculto `email_tecnico`.
- La normalización de seriales de SmartOLT.
- La lógica de "Despacho Manual Estricto" (Visual vs Data).

## 3. Flujo de Trabajo Específico
1.  **Consulta:** Lee la sección relevante en `wisphub_technical_memory.md`.
2.  **Script:** Usa `scripts/diagnose_wisphub_raw.mjs` o similar para verificar qué está devolviendo la API realmente HOY.
3.  **Código:** Implementa cambios en `src/`.
4.  **Actualización:** Si descubres un nuevo comportamiento extraño de la API, **AGRÉGALO** a `wisphub_technical_memory.md`.

## 4. Scripts de Utilidad Existentes
- `scripts/check_autoassign_db.mjs` (Verificar asignaciones)
- `scripts/diagnose_wisphub_raw.mjs` (Ver raw response)
- `scripts/verify_vps_connection.mjs` (Probar conectividad)
