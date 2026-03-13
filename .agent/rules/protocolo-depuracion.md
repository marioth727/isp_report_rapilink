---
trigger: always_on
---

# DEBUGGING & DATA INTEGRITY RULES
Estas reglas tienen prioridad ABSOLUTA sobre cualquier otra instrucción cuando estés en modo "fix" o "debug".

## 1. PRINCIPIO DE "ZERO TRUST"
- **Prohibido decir "Solucionado":** No puedes marcar una tarea como completada basándote en que "el código parece bien". Solo se marca como completada si ves un log de éxito en la consola.
- **Verificación de Tipos:** Nunca asumas que un ID es un `Number` o un `String`. Verifica el tipo de dato (`typeof`) antes de compararlo.

## 2. TRAZABILIDAD OBLIGATORIA (Caso Tickets/API)
Antes de realizar cualquier llamada a la API externa o consulta a la base de datos que esté fallando, DEBES inyectar logs que impriman:
1.  `[INTERNAL]` El ID del usuario en tu base de datos local.
2.  `[MAPPING]` El valor EXACTO del campo mapeado (`external_id`) que usará la API. **Si es `undefined` o `null`, el proceso debe abortar ahí mismo.**
3.  `[REQUEST]` La URL final y el Payload/Body que se envía.
4.  `[RESPONSE]` La respuesta cruda (raw) de la API, incluso si es un array vacío `[]`.

## 3. ESTRATEGIA DE AISLAMIENTO
- Si la app principal es muy grande, crea un script mínimo en `scripts/reproduce_issue.mjs` que solo haga la conexión a la base de datos y la llamada a la API.
- Depura sobre ese script pequeño. Una vez funcione allí, migra la solución al código principal.