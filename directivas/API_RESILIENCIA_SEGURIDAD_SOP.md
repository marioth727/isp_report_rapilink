# SOP: RESILIENCIA EN API Y SEGURIDAD (AUTH)
> **ID:** DIRECTIVA-010
> **Autor:** Agente Antigravity
> **Fecha:** 2026-02-26

## 1. Objetivo
Evitar cierres de sesión inesperados, fallos en la sincronización de datos y asegurar que el mapeo entre WispHub y Supabase sea infalible y resistente a errores de red o inconsistencias de la API externa.

## 2. Insumos y Prerrequisitos
- [ ] API Key de WispHub en `.env`.
- [ ] Versión estable de `@supabase/supabase-js` (v2.45.0+).
- [ ] Scripts de diagnóstico en `scripts/`.

## 3. Pasos de Ejecución Proactiva

1.  **Diagnóstico Antes de Sincronizar:**
    - Antes de realizar un upsert masivo, se DEBE ejecutar un script de conteo y validación de muestra (ej. `scripts/quick_check.mjs`).
2.  **Mapeo Robusto de Técnicos:**
    - Nunca confiar solo en el `ID`. Si el ID es `undefined` o string nulo, buscar por nombre exacto en la lista de `staff`.
    - Asignar siempre un fallback (`tecnico_usuario = null` o `ID: Desconocido`) para evitar que el ticket desaparezca de la base de datos.
3.  **Persistencia de Sesión Supabase:**
    - No implementar `setInterval` manual para refrescar tokens.
    - Confiar en `autoRefreshToken: true` de Supabase nativo.
    - Usar un listener simple en `App.tsx` para atrapar eventos de `SIGNED_OUT` y limpiar el estado local sin bucles infinitos.

## 4. Trampas Conocidas (Casos Borde)
- **Error oauth_client_id:** Si aparece este error en consola, significa que la versión de la librería de Supabase es inestable (ej. v2.90.1). Bajarse inmediatamente a una versión estable.
- **IDs Duplicados en WispHub:** La API de WispHub a veces devuelve el mismo ID interno para tickets diferentes. Usar siempre `id_ticket` (reference_id) como clave primaria única en Supabase.

## 5. Criterios de Éxito
- La sesión de usuario se mantiene activa por al menos 24 horas sin deslogueos.
- La sincronización de tickets no falla por errores de mapeo de nombres.
- No hay tickets "huérfanos" (sin técnico) si existen en la API.
