# SOP: Gestión de Tickets WispHub y Asignación
> **ID:** DIRECTIVA-WISPHUB-TICKETS-001
> **Fuente:** `docs/wisphub_technical_memory.md`

## 1. Objetivo
Gestionar la sincronización, filtrado y asignación de tickets desde/hacia WispHub.

## 2. URL y Autenticación
- **URL Base:** `https://www.wisphub.io` (⛔ NUNCA usar `.net`, `api.`, ni `app.`)
- **Header:** `Authorization: Api-Key {VITE_WISPHUB_API_KEY}`
- **Content-Type para PUT:** `multipart/form-data` (según docs oficiales)
- **Proxy Vite:** `/api/wisphub/` → reescribe a `www.wisphub.io/api/` + inyecta Api-Key

## 3. Endpoints Clave
| Método | Endpoint | Uso |
|---|---|---|
| GET | `/api/tickets/?limit=100&estado=1` | Listar tickets filtrados |
| PUT | `/api/tickets/{id_ticket}/` | Editar ticket (requiere TODOS los campos obligatorios) |

### Parámetros Requeridos para PUT
- `asunto` (string): Debe coincidir exactamente con `asunto_default`
- `prioridad` (integer): 1=Baja, 2=Normal, 3=Alta, 4=Muy Alta
- `estado` (integer): 1=Nuevo, 2=En Progreso, 3=Resuelto, 4=Cerrado, 5=Reagendado
- `descripcion` (string)
- `tecnico`: ID del técnico correcto

## 4. Trampas Conocidas (CRÍTICO)
> [!CRITICAL]
> - **Campo Oculto:** `tecnico: null` pero dato en `email_tecnico`.
> - **Mapeo:** `nombre_tecnico` NO viene de la API. Se genera con `mapTicket()`.
> - **Desfase Horario:** +5 horas en `fecha_fin`.
> - **Filtros Ignorados:** La API puede ignorar `tecnico_usuario` y devolver todo → Siempre filtro local (Zero Trust).
> - **id_estado no viene en GET:** Se mapea localmente con `STA_MAP` desde string `estado`.
> - **Rate Limit:** No hacer paralelo. Secuencial con delay 300-400ms.
> - **Paginación:** Máx ~300 items por request. Usar `limit=100` + paginar.

## 5. Captura de Datos Operativos (Potencia)
1. El técnico ingresa potencia en dBm (-14 a -27 rango aceptable)
2. Se guarda en `workflow_processes.metadata.potencia`
3. Se inyecta al comentario de resolución: `[POTENCIA: -XX.X dBm]`
4. Si falla sync, se guarda en `SyncQueue`

## 6. Reglas de Sincronización Espejo
1. **Detective Silencioso:** Tickets locales en estado Abierto (1,2,5) que NO aparecen en WispHub → eliminar localmente (fantasmas)
2. **Reasignación:** Si `tecnico_usuario` difiere entre espejo y API → confiar en API y actualizar Supabase
3. **Upsert:** Siempre `upsert(data, { onConflict: 'reference_id' })`
4. **Radar de Hoy:** `radarSyncToday()` escanea tickets creados hoy cada 2 min

## 7. Procedimiento de Implementación

### Caso A: Filtrar por Técnico
1. **No filtrar en API:** No intentar `GET /api/tickets/?tecnico=Juan`
2. **Filtrar Localmente:** Cargar tickets y usar `mapTicket()` primero

### Caso B: Fechas y Cierres
1. Al leer `fecha_fin`, restar 5h si necesario para hora local
2. Parseo resiliente: detectar `MM/DD` vs `DD/MM` (Bug 43201m)

## 8. Scripts de Verificación
- `scripts/check_wisphub_staff.mjs` (Verificar nombres de técnicos)
- `scripts/diagnose_wisphub_raw.mjs` (Ver respuesta cruda de API)
- `scripts/diagnostico_wisphub_estados.mjs` (Contar tickets por estado)
- `scripts/verify_workflow_metadata.mjs` (Verificar potencia en Supabase)
