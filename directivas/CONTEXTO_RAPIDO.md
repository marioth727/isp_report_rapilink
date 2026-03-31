# Contexto Rápido - ISP Reports App
> Última actualización: 2026-03-29

## URLs y Servicios (CANÓNICAS - NO MODIFICAR)
| Servicio | URL | Notas |
|---|---|---|
| **WispHub API (REST)** | `https://api.wisphub.io` | ⛔ NUNCA usar `www.` (nginx 403) ni `.net` (es docs) |
| **WispHub Sitio Web** | `https://www.wisphub.io` | Solo navegador, NO para API calls |
| **WispHub Docs** | `https://wisphub.net` | Solo documentación |
| **Supabase** | `https://supabase.rapilinksas.co` | Self-hosted |
| **SmartOLT** | `https://rapilinksas.smartolt.com` | API con X-Token |
| **Proxy Vite** | `localhost:5173/api/wisphub/` | Reescribe a `api.wisphub.io/api/` + inyecta Api-Key |

## WispHub: Estados de Ticket
| id_estado | Nombre | Uso operativo |
|---|---|---|
| 1 | Nuevo | Ticket recién creado |
| 2 | En Progreso | Técnico trabajando |
| 3 | Resuelto | Completado |
| 4 | Cerrado | Archivado |
| 5 | Reagendado | **= Ticket Escalado/Reasignado** (badge ámbar en UI) |

## Trampas Conocidas (1 línea cada una)
- **WispHub no devuelve `id_estado`** en GET /tickets/. Se mapea con `STA_MAP` local desde el string `estado`.
- **WispHub no devuelve `nombre_cliente`**. El identificador del cliente es el campo `servicio`.
- **Filtros ignorados:** WispHub puede ignorar `tecnico_usuario` y devolver todo. Siempre aplicar filtro local (Zero Trust).
- **Desfase horario:** `fecha_fin` de WispHub tiene offset +5h. Normalizar antes de comparar.
- **Upsert Supabase:** Siempre usar `upsert(data, { onConflict: 'reference_id' })`, nunca sin parámetros.
- **SSL:** El certificado de wisphub.io falla en Node. Proxy Vite usa `secure: false`. Scripts usan `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- **Campo oculto:** `tecnico: null` pero el dato puede estar en `email_tecnico`.
- **Rate Limit WispHub:** No hacer peticiones paralelas. Usar secuencial con delay 300-400ms.
- **Paginación WispHub:** Máximo ~300 items por request masivo. Usar `limit=100` + paginar.

## Archivos Protegidos (Precaución extrema al editar)
- `src/lib/workflowService.ts` — Motor de sincronización y lógica de negocio
- `src/lib/wisphub.ts` — Comunicación con API WispHub + mapTicket
- `src/pages/OperationsMyTasks.tsx` — Vista de tareas del técnico
- `src/pages/OperationsDispatch.tsx` — Centro de despacho con drag & drop
- `vite.config.ts` — Proxy de APIs (WispHub + SmartOLT)

## Decisiones de Arquitectura (Ya tomadas, NO re-debatir)
- **Despacho Visual ≠ Data:** Las columnas del tablero cargan VACÍAS (o localStorage). Prohibido mergear desde DB al inicio.
- **Radar de Fondo:** `radarSyncToday()` escanea tickets de hoy cada 2 min automáticamente.
- **Detective Silencioso:** `silentDetectiveSync()` purga tickets fantasma que ya no existen en WispHub. (¡OJO! Si el proxy 403 falla, borrará todo el espejo. Usar `node scripts/wisphub_mirror_cron.mjs` para restaurar).
- **Espejo Supabase:** Staff y tickets se cachean localmente. El frontend lee del espejo, no de la API directa.
- **Drag & Drop:** Usar `draggableId` (ID ticket), NUNCA `source.index`.

## Autenticación
- **WispHub:** Header `Authorization: Api-Key {VITE_WISPHUB_API_KEY}` (lo inyecta el proxy)
- **SmartOLT:** Header `X-Token: {VITE_SMARTOLT_API_KEY}`
- **Supabase:** Anon key en `.env` (JWT auto-refresh con protección anti-500)
