# SOP: [NOMBRE DE LA TAREA]
> **ID:** DIRECTIVA-00X
> **Autor:** Agente Antigravity
> **Fecha:** 2026-MM-DD

## 1. Objetivo
Describir brevemente qué se quiere lograr.
*Ejemplo:* Implementar un nuevo endpoint para sincronizar datos de WispHub sin bloquear la UI.

## 2. Insumos y Prerrequisitos
Qué necesitas antes de empezar.
- [ ] Acceso a API WispHub (Key en `.env`)
- [ ] Script de prueba en `scripts/test_wisphub.mjs`

## 3. Pasos de Ejecución (Paso a Paso)
Lista ordenada y determinista.

1.  **Crear Script de Diagnóstico:**
    - Crear `scripts/diagnose_wisphub.mjs`
    - Validar que responde el endpoint.
2.  **Modificar Servicio:**
    - Editar `src/lib/wisphub.ts`
3.  **Verificar:**
    - Ejecutar de nuevo el script de diagnóstico.

## 4. Trampas Conocidas (Casos Borde)
> [!WARNING]
> Aquí va la "Memoria del Dolor". Lo que aprendiste que NO debes hacer.

- **No usar `axios`**, usar `fetch` nativo de Node.js v18+.
- **No mezclar BD con Vista**, usar `localStorage` para caché visual (Lección aprendida: 2026-02-12).

## 5. Criterios de Éxito
- El script retorna HTTP 200.
- No hay errores en consola.
