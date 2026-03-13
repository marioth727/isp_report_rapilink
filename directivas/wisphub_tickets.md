# Directiva: Gestión de Tickets WispHub

**Objetivo:** Gestionar la creación, edición y consulta de tickets en la plataforma WispHub a través de su API.

## Endpoints

### Editar Ticket (PUT)
**URL:** `https://api.wisphub.net/api/tickets/{id_ticket}/`
**Método:** `PUT`
**Headers:**
- `Authorization: Api-Key {API_KEY}`
- `Content-Type: multipart/form-data` (se recomienda usar form-data si se envían archivos, o json si la API lo permite, la documentación dice multipart/form-data en Schemas pero PUT suele aceptar JSON en APIs REST modernas, verificar).
**Nota:** La documentación oficial menciona `multipart/form-data` para el Request Body schema, pero el ejemplo curl muestra `--form` que es multipart. Sin embargo, el ejemplo de respuesta es JSON.

### Parámetros Requeridos (Body)
- `id_ticket` (en path)
- `asunto` (string): Debe coincidir con `asunto_default` o validarse con `Listado de asuntos`.
- `prioridad` (integer): 1: Baja, 2: Normal, 3: Alta, 4: Muy Alta.
- `estado` (integer): 1: Nuevo, 2: En Progreso, 3: Resuelto, 4: Cerrado.
- `descripcion` (string).

## Restricciones y Advertencias
1.  **URL Base:** La documentación oficial apunta a `api.wisphub.net`. El proyecto actual usa `api.wisphub.io`. **Verificar cual es la correcta.**
2.  **Formato de Asunto:** El asunto debe ser EXACTO a los predefinidos o la API podría rechazarlo o crear inconsistencias.
3.  **Tecnico:** Se debe enviar el ID del técnico correcto.
4.  **Codificación:** Asegurar que los textos con tildes/ñ se envíen en UTF-8 correcto.
5.  **Trampa de Filtros Ignorados:** La API de WispHub (especialmente en `/tickets/` e `/instalaciones/`) puede ignorar parámetros como `tecnico_usuario` o `tecnico` si el valor no existe o por fallos internos, devolviendo la lista completa de tickets recientes en lugar de una lista vacía.
    *   *Solución Inamovible:* Aplicar siempre un filtro local post-consulta (Zero Trust) verificando que el campo `tecnico_usuario` o el ID del técnico en el objeto JSON coincida realmente con lo solicitado antes de procesar o mostrar los datos.
6.  **Trampa de la API (id_estado):** La respuesta de la API `GET /api/tickets/` NO incluye el campo `id_estado` en los objetos, aunque permite filtrar por él en la URL. 
    *   *Solución:* Durante la sincronización, se debe mapear el campo `estado` (string) al `id_estado` (number) usando un diccionario local (`STA_MAP`).
7.  **Restricción de Supabase (Upsert):** Al usar `upsert` en la tabla `workflow_processes`, se debe especificar el conflicto sobre `reference_id` para evitar errores de clave duplicada cuando varios procesos intentan actualizar el mismo ticket de WispHub.
    *   *Nota:* No hacer `upsert(chunk)` sin parámetros. Hacer `upsert(chunk, { onConflict: 'reference_id' })`.

## Procedimiento de Pruebas
1.  Usar scripts en `scripts/` para validar conexión antes de integrar en frontend.
2.  Probar primero GET para verificar auth.
3.  Al editar, enviar todos los campos obligatorios para evitar borrar datos existentes (si el PUT no es PATCH).

## Reglas de Sincronización Espejo (Stale-While-Revalidate)
1. **Paginación y Ocultamiento de API:** La API de WispHub presenta fallos documentados al buscar IDs específicos (Error 403) y oculta resultados (límites de 300 items en requests masivos). 
2. **El Detective (Sync de Fondo):** Para mantener Supabase (FrontEnd) sincronizado sin crear workflows de N8N, se usa el patrón `silentDetectiveSync()` en React (`WorkflowService`).
   * *Regla:* Cuando se detectan tickets locales en estado "Abierto" (`1,2,5`) que YA NO aparecen en la consulta de los últimos 60 días de WispHub, **deben ser eliminados localmente** por ser "Tickets Fantasma" perdidos o cerrados silenciosamente.
   * *Regla:* Si el ticket sigue abierto en WispHub pero el campo `tecnico_usuario` difiere del espejo local, se debe confiar en la API y actualizar Supabase en el fondo.
