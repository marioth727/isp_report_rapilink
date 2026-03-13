# SOP: RENDIMIENTO Y OPTIMIZACIÓN DE DATOS (SUPABASE)
> **ID:** DIRECTIVA-011
> **Autor:** Agente Antigravity
> **Date:** 2026-02-26

## 1. Objetivo
Asegurar que la aplicación sea escalable y mantenga tiempos de respuesta inferiores a 500ms al consultar grandes volúmenes de tickets (5,000+), optimizando el uso de Supabase y evitando cuellos de botella en la red.

## 2. Insumos y Prerrequisitos
- [ ] Dashboad de Supabase (SQL Editor).
- [ ] Herramienta `EXPLAIN` para análisis de queries.

## 3. Estrategias de Optimización

1.  **Consultas JSONB (Metadata):**
    - Al filtrar por campos dentro de `metadata`, usar siempre el operador `->>` de Postgres.
    - Si el volumen de tickets crece, crear indices GIN sobre la columna `metadata`.
2.  **Paginación Obligatoria:**
    - Prohibido traer más de 1000 registros en una sola llamada desde el frontend.
    - Implementar carga infinita o paginación por bloques de 100-200 tickets en vistas masivas como "Despacho".
3.  **Filtros en Servidor (Server-side Filtering):**
    - Preferir siempre filtrar por `id_estado` o `tecnico_usuario` directamente en la query de Supabase antes de traer los datos a la memoria de React.
4.  **Uso de Vistas y RPC:**
    - Para reportes complejos, no cruzar tablas en el cliente. Crear vistas SQL o funciones RPC en Supabase y llamarlas desde `lib/workflowService.ts`.

## 4. Trampas Conocidas (Casos Borde)
- **Select '*' es Tentador Pero Lento:** Evitar traer toda la metadata si solo se necesita el ID y el Nombre del cliente para un listado simple.
- **Connection Pool:** Al sincronizar masivamente desde `scripts/`, usar delays entre lotes para no saturar el pool de conexiones de Supabase.

## 5. Criterios de Éxito
- La vista de despacho carga en menos de 1 segundo.
- No hay errores de "Connection Timeout" durante las cargas masivas.
- El uso de memoria del navegador se mantiene estable incluso con miles de tickets sincronizados.
