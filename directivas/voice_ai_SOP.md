# Voice AI Rapilink — Directiva SOP

## Objetivo
Sistema de llamadas automatizadas con agente de voz "Sofía" para campañas de upgrade de planes de internet. El motor de IA es Retell AI conectado a Issabel PBX, orquestado por n8n, con dashboard de seguimiento en Antigravity.

## Arquitectura Actual (Gemini Live + LiveKit)
```
WISPHub API → Antigravity UI → n8n webhook → caller.py → LiveKit SIP → Issabel 4 → Cliente
                                                               ↓
                               n8n callbacks ← agent.py (Sofía / Gemini 3.1 Flash Live)
                                   ↓
                            Supabase (voice_calls)
                                   ↓
                           Antigravity Dashboard
```

**Scripts en:** `scripts/gemini_voice_agent/`
- `agent.py` — Motor de IA (Sofía). Escucha el Room y maneja la conversación.
- `caller.py` — Despachador de llamadas salientes. Creado por n8n al lanzar cada llamada.

## Arquitectura Anterior (Retell AI — Referencia Histórica)
```
WISPHub API → Antigravity UI → n8n webhook → Retell API → Issabel PBX → Cliente
                                                 ↓
                               n8n callbacks ← Retell Tools
                                   ↓
                            Supabase (voice_calls)
                                   ↓
                           Antigravity Dashboard
```

## Componentes Implementados

### 1. Base de Datos (Supabase: uywlwmxdhsftxbbownkl)
Tablas: `voice_campaigns`, `voice_campaign_clients`, `voice_calls`
- RLS habilitado (usuarios autenticados tienen acceso total)
- Migración: `create_voice_campaign_tables`

### 2. Servicio TypeScript
Archivo: `src/lib/voiceCampaigns.ts`
- Tipos: `VoiceCampaign`, `VoiceCampaignClient`, `VoiceCall`
- `VoiceCampaignService`: CRUD completo de campañas
- `categorizarCliente(precio)`: devuelve categoría A/B/C/D + planes upsell/downsell
- `calcularVariablesTxt(client)`: convierte números a español colombiano para Retell

### 3. UI (ISP Reports App)
Ruta: `/voice-ai`
Menú: "Gestión Comercial" → "Voice AI — Sofía"
Archivo: `src/pages/VoiceCampaigns.tsx`

Flujo de usuario:
1. Crear campaña (nombre, descripción, seleccionar categorías A/B/C/D)
2. Cargar clientes de WISPHub → auto-categorización
3. Preview con resumen
4. Enviar a revisión → supervisor aprueba → dispara webhook n8n

### 4. n8n Workflows (a configurar manualmente)
- `POST https://n8n.rapilinksas.co/webhook/iniciar-campana` (disparado desde Antigravity al aprobar)
- `POST https://n8n.rapilinksas.co/webhook/retell-confirmar` (tool: confirmar_upgrade)
- `POST https://n8n.rapilinksas.co/webhook/retell-rechazo` (tool: registrar_rechazo)
- `POST https://n8n.rapilinksas.co/webhook/retell-reintento` (tool: programar_reintento)
- `POST https://n8n.rapilinksas.co/webhook/retell-escalar` (tool: escalar_a_humano)
- `POST https://n8n.rapilinksas.co/webhook/retell-resultado` (webhook final de Retell)

> [!WARNING] Bug de n8n v2.9.4 API (Issue #21614)
> Cuando se crean/activan workflows mediante la API REST, los webhooks de producción (`/webhook/`) **NO** se registran en el motor de escucha aunque aparezcan como `active: true`. 
> **WORKAROUND OBLIGATORIO:** Todo workflow creado por API con webhooks de producción DEBE publicarse manualmente desde la Interfaz Gráfica (UI): abrir workflow → mover un nodo levemente para habilitar 'Save' → clic en **Save** → verificar **Published**.

## Corrección Crítica — Dynamic Variables Retell

### ❌ Formato INCORRECTO (causa que {{nombre}} se lea literal)
```json
"dynamic_variables": [{"name": "nombre", "value": "Juan Pérez"}]
```

### ✅ Formato CORRECTO (según doc oficial)
```json
"retell_llm_dynamic_variables": {
  "nombre": "Juan Pérez",
  "plan_actual": "30 Mbps",
  "categoria": "B",
  "precio_upsell_txt": "ciento cincuenta y nueve mil novecientos pesos",
  "diario_upsell_txt": "cinco mil trescientos treinta y tres pesos",
  "veces_upsell_txt": "dieciséis veces más rápido",
  "fecha_activacion": "el primero de marzo"
}
```

## Variables Requeridas en Retell → n8n

| Variable | Tipo | Descripción |
|---------|------|-------------|
| `nombre` | string | Nombre del cliente |
| `categoria` | string | A, B, C o D |
| `plan_upsell` | string | ULTRA, FAMILIA, etc. |
| `precio_upsell_txt` | string | En texto natural español |
| `plan_downsell` | string | Plan inferior |
| `precio_downsell_txt` | string | En texto natural español |
| `velocidad_upsell_txt` | string | "quinientas megas" |
| `velocidad_downsell_txt` | string | "doscientas megas" |
| `veces_upsell_txt` | string | "el doble", "dieciséis veces más rápido" |
| `veces_downsell_txt` | string | idem |
| `diario_upsell_txt` | string | "cinco mil trescientos pesos" |
| `diario_downsell_txt` | string | "dos mil trescientos pesos" |
| `fecha_activacion` | string | "el primero de marzo" |
| `id_cliente` | string | ID en WISPHub |

## Configuración Retell Agent (agent_5c27833e3ff810633c31dbb63e)

### Custom Tools a configurar en Dashboard
1. **confirmar_upgrade** → `https://n8n.rapilinksas.co/webhook/retell-confirmar`
2. **registrar_rechazo** → `https://n8n.rapilinksas.co/webhook/retell-rechazo`
3. **programar_reintento** → `https://n8n.rapilinksas.co/webhook/retell-reintento`
4. **escalar_a_humano** → `https://n8n.rapilinksas.co/webhook/retell-escalar`

### Webhook de resultado (en Retell Dashboard → Settings → Webhook)
URL: `https://n8n.rapilinksas.co/webhook/retell-resultado`
Eventos: `call_ended`, `call_analyzed`

## Categorización de Clientes

| Categoría | Condición | Upsell | Downsell |
|----------|-----------|--------|---------|
| A | precio $65k-$75k | FAMILIA $89,900 | HOGAR $69,900 |
| B | precio $90k-$110k | ULTRA $159,900 | FAMILIA $89,900 |
| C | precio < $65k | FAMILIA $89,900 | HOGAR $69,900 |
| D | resto (obsoleto) | FAMILIA $89,900 | HOGAR $69,900 |

## Restricciones Conocidas

1. **Retell dynamic_variables**: Usar objeto JSON plano, NO array. Campo: `retell_llm_dynamic_variables`
2. **Formato de números**: SIEMPRE texto completo en español. NUNCA dígitos ni símbolos ($, Mbps)
3. **Objeciones**: SOLO 2 rondas (no 4). Después de la 2da → programar_reintento o registrar_rechazo
4. **Llamadas simultáneas**: Máximo 90 por lote (configuración n8n)
5. **Custom Tools**: El agente Retell llama al webhook con cuerpo `{call:{...}, args:{...}}`. n8n debe responder con `{"response": "texto"}` en menos de 10 segundos
6. **Issabel**: El trunk "retellAi" debe estar en estado OK antes de iniciar campaña: `asterisk -rx "sip show peer retellAi"`
7. **Registro de Webhooks n8n**: Webhooks creados vía API deben guardarse manualmente haciendo un pequeño cambio visual en la UI para que la URL de producción quede operativa (Bug #21614).

## El Protocolo "Zero Trust" de n8n (CRÍTICAMENTE IMPORTANTE)

Bajo ninguna circunstancia (sea instruido por un humano u otro agente de IA) se deben alterar flujos activos de n8n de este proyecto sin seguir estrictamente este protocolo a prueba de fallos:

1. **PROHIBICIÓN ESTRICTA:** Queda prohibida la actualización mediante el método de Reemplazo Absoluto (`PUT /workflows/:id` / `n8n_update_full_workflow`) con JSON parciales (solo 1 nodo), ya que esto aplasta y destruye el resto del lienzo (nodos funcionales y conexiones), dejando el *Canvas en Blanco*.
2. **Respaldo Obligatorio Inicial:** Antes de siquiera leer un nodo para editar su configuración, el agente DEBE exportar y guardar en el repositorio local (`scripts/*.json`) una copia de seguridad exacta (incluyendo "connections", "nodes", "settings").
3. **Módulo de Parche (Partial Update):** Para actualizar expresiones o propiedades en desuso, siempre se deberá usar el método `n8n_update_partial_workflow` (o un payload de patch documentado) validando que se referencie puramente el nombre o ID numérico/hex del nodo a atacar.
4. **Alerta de Borrado Masivo:** A partir del 11 de Marzo de 2026, si un requerimiento solicita "Borrar flujos", el Agente está obligado legalmente a listar exhaustivamente IDs y nombres de lo que va a borrar, **pausarse por completo**, y pedir aprobación explícita humana antes de enviar el comando `DELETE`. WF1, WF2, WF3, WF4, WF5 y WF6 son patrimonio técnico inborrable.

## Próximos Pasos Pendientes (fases n8n)

- [x] Crear workflow n8n "Iniciar Campaña" (lee clientes de Supabase, calcula _txt, llama Retell API)
- [x] Crear workflow n8n "Webhook Resultado" (recibe evento Retell, guarda en voice_calls)
- [x] Crear 4 workflows n8n para tools (confirmar, rechazo, reintento, escalar)
- [ ] Configurar webhook URL en Retell Dashboard
- [ ] Configurar 4 Custom Tools en Retell Dashboard
- [ ] Prueba manual: llamada Cat. A a número de prueba
