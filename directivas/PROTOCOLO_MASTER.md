# PROTOCOLO MAESTRO DE DESARROLLO (La Regla de Oro)

Este documento adapta la "Regla Global" del usuario al entorno de desarrollo de **ISP Reports App** (Node.js/React/Supabase).

## 1. El Bucle Central (Orden Estricto)

Cualquier tarea de complejidad media/alta DEBE seguir este ciclo. **Prohibido saltar pasos.**

1.  **Directiva (Planning):**
    *   Antes de tocar código `src/`, busca en `directivas/` si existe un procedimiento para lo que vas a hacer.
    *   Si NO existe, CRÉALO.
    *   Si SÍ existe, LÉELO y apégate a él.

2.  **Script de Diagnóstico/Prueba (Execution):**
    *   No adivines. Crea un script en `scripts/` (usando `.mjs` o `.ts`) para validar tu teoría o reproducir el error.
    *   Ejemplo: `check_autoassign_db.mjs`, `verify_vps_connection.mjs`.

3.  **Implementación (Action):**
    *   Solo cuando el script confirme tu teoría, modifica el código fuente en `src/`.

4.  **Memoria (Learning):**
    *   Si descubriste algo nuevo (un bug, una limitación de API, una decisión de diseño), **ACTUALIZA** la Directiva correspondiente o la Memoria Técnica en `docs/`.
    *   *Ejemplo:* "Aprendimos que WispHub usa fechas futuras para los cierres, agregar nota en `wisphub_technical_memory.md`".

## 2. Estructura de Archivos

- **`directivas/`**: SOPs (Standard Operating Procedures). Archivos `.md` que explican CÓMO hacer algo.
    - *Ejemplo:* `DEPLOY_VPS.md`, `MANEJO_ERRORES_API.md`, `NUEVO_MODULO.md`.
- **`scripts/`**: Herramientas de diagnóstico aisladas.
    - *Regla:* Nunca deben importar directamente del `src/` si eso arrastra dependencias de React. Deben ser ejecutables con `node script.mjs`.
- **`docs/`**: Memoria Técnica del Sistema.
    - *Uso:* Para documentar arquitectura, decisiones de diseño y lecciones aprendidas.

## 3. El Protocolo de Auto-Corrección

Si algo falla:
1.  **PAUSA.** No intentes "probar otra cosa" a ciegas.
2.  **Diagnostica** con un script.
3.  **Corrige** el código.
4.  **DOCUMENTA** el error en la Directiva o Memoria para que la próxima IA no lo repita.

---
> "Una IA que no documenta sus errores está condenada a repetirlos."
