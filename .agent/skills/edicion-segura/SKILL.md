# Skill: Edición Segura de Archivos Críticos
> **ID:** SKILL-ANTI-REGRESION
> **Propósito:** Prevenir que cambios nuevos rompan funcionalidades existentes durante la automatización de IAs (Agentes).

## 1. El Problema (Contexto)
Cuando el proyecto madura, la IA puede realizar reemplazos destructivos en archivos centrales (ej: `wisphub.ts`, `workflowService.ts`, `OperationsMyTasks.tsx`) si pierde el contexto previo. Esto genera bucles de reparación de fallos funcionales ("corrijo A, rompo B").

## 2. Instrucciones Estrictas para la IA 
Cada vez que debas modificar cualquier archivo dentro de `src/`, estás OBLIGADO a seguir estos pasos (Paso a Paso):

1. **Revisión del Mapa de Dependencias**: 
   Antes de editar, pregúntate: ¿Qué otros módulos usan las funciones que voy a cambiar? Usa `grep_search` para confirmar dónde se usan antes de editarlas.
2. **Edición Quirúrgica, NO Reescribir**:
   NUNCA pidas modificar una función entera si solo falla una línea. Localiza el problema exacto y realiza pequeños parches localizados.
3. **El Estado Base "Build Check"**:
   - ANTES de confirmar el éxito al usuario, corre `npm run build`.
   - Si lanza errores nuevos en TypeScript, **DETENTE**. Has provocado una regresión.
   - Aplica el revert (regresa el código a como estaba) u obligate a depurar los errores del build inmediatamente antes de cantar victoria.

## 3. Comandos Permitidos
Para probar la seguridad del código, SIEMPRE usarás la cadena:
`npm run build`

## 4. Archivos Extremadamente Sensibles (Tocar con Cuidado)
Si la tarea implica alguno de estos archivos, alerta al usuario antes de proceder:
- `src/lib/workflowService.ts` (Motor de Sync de base de datos local y estado)
- `src/lib/wisphub.ts` (API WispHub nativa)
- `src/pages/OperationsMyTasks.tsx` (Vistas e interactividad del técnico)
- `scripts/wisphub_mirror_cron.mjs` (Proceso crítico de segundo plano)
