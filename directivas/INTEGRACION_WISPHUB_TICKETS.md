# SOP: Gestión de Tickets WispHub y Asignación
> **ID:** DIRECTIVA-WISPHUB-TICKETS-001
> **Fuente:** `docs/wisphub_technical_memory.md` (Sección 2, 4 y 7)

## 1. Objetivo
Gestionar la sincronización, filtrado y asignación de tickets desde/hacia WispHub.

## 2. Trampas Conocidas (CRÍTICO)
> [!CRITICAL]
> **Campo Oculto:** WispHub a veces devuelve `tecnico: null` pero el dato está en `email_tecnico`.
> **Mapeo:** El campo `nombre_tecnico` NO viene de la API. Se genera localmente con `mapTicket()`.
> **Desfase Horario:** La API de WispHub suele tener un offset de +5 horas en fechas de cierre.

## 3. Procedimiento de Implementación

### Caso A: Filtrar por Técnico
1.  **No filtrar en API:** No intentar `GET /api/tickets/?tecnico=Juan`.
2.  **Filtrar Localmente:** Cargar tickets y usar `mapTicket()` primero.
3.  **Lógica de "Instalaciones":**
    - Verificar variantes: `"instalaciones@rapilink-sas"` y `"instalaciones aprobadas"`.

### Caso B: Fechas y Cierres
1.  **Normalización:** Al leer `fecha_fin`, aplicar resta de 5 horas si es necesario para coincidir con hora local.
2.  **Parseo Resiliente:** Usar la lógica de detección `MM/DD` vs `DD/MM` documentada (Bug 43201m).

## 4. Scripts de Verificación
- `scripts/check_wisphub_staff.mjs` (Verificar nombres de técnicos)
- `scripts/diagnose_wisphub_raw.mjs` (Verificar respuesta cruda de API)
