# Directiva: Gestión del Webhook de Retell AI (Post-Llamada)

**Objetivo:** Recibir los resultados de las llamadas hechas por Sofía (Retell AI), procesar el análisis de la IA y actualizar el estado de los clientes y estadísticas de la campaña en Supabase.

## Arquitectura de Flujo (Retell -> Webhook -> Supabase)

El webhook será manejado por **n8n**. Retell disparará eventos al webhook cada vez que una llamada finalice y se analice.

### Disparadores (Triggers) de Retell
Retell AI envía un evento principal que nos interesa para los resultados finales: `call_analyzed`.

### Datos de Entrada (Payload de Retell)
El payload de Retell incluye el objeto de la llamada, donde extraeremos los datos críticos:
- `call.call_id`: ID único de la llamada en Retell.
- `call.call_status`: Estado final (ej. "registered", "ringing", "in_progress", "completed", "error").
- `call.recording_url`: URL del audio de la llamada (si está activado).
- `call.transcript`: Transcripción completa del diálogo.
- `call.retell_llm_dynamic_variables`: Variables con las que se inició la llamada (tiene el `id_cliente_wisphub` o `call_id` de nuestra BD local).
- `call.call_analysis`: Aquí reside la verdadera magia extraída por el LLM.

### Variables Personalizadas de Análisis (Post-Call Analysis)
Debes configurar en Retell (Custom Analysis) las siguientes variables para que el webhook sepa qué hacer:
1. `resultado_llamada` (Enum): `acepto`, `rechazo`, `reintento`, `escalado`, `no_contesto`, `buzon`.
2. `plan_aceptado` (String): El nombre del plan que el cliente aceptó (HOGAR, FAMILIA, etc.).
3. `precio_aceptado` (Number): El precio exacto pactado en la llamada.
4. `motivo_rechazo` (String): Explicación breve de por qué no aceptó.
5. `fecha_reintento` (String): Si pidió que lo llamen después (YYYY-MM-DD HH:MM).

## Lógica de Procesamiento (Pasos para n8n)

1. **Recibir Webhook (POST)**: 
   - Escuchar método POST.
   - Validar que el evento sea `call_analyzed`. Si es otro (ej. `call_started`), terminar el flujo con 200 OK.
2. **Extraer Metadata**:
   - Extraer `call_id_retell` = `body.call.call_id`.
   - Extraer `resultado_llamada` = `body.call.call_analysis.resultado_llamada`.
   - Extraer `id_cliente_local` = de las variables dinámicas que se le pasaron a Retell.
3. **Actualizar DB (voice_calls)**:
   - Hacer un `UPDATE` en la tabla `voice_calls` de Supabase donde `call_id_retell = call_id`.
   - Setear `estado = 'completada'`, `resultado = resultado_llamada`, `transcript = body.call.transcript`.
4. **Actualizar DB (voice_campaign_clients) - Opcional pero recomendado**:
   - Actualizar el estado del cliente a `completado` o `error` basándose en el resultado.
5. **Aumentar Contadores de Campaña (voice_campaigns)**:
   - Incrementar dinámicamente: `llamadas_completadas + 1`.
   - Y según el caso: `llamadas_aceptaron + 1`, `llamadas_rechazaron + 1`, o `llamadas_reintento + 1`.

## Fallas Conocidas y Restricciones
- **Trampa de Tiempo**: Retell a veces se demora unos minutos en enviar el evento `call_analyzed` si la llamada fue de más de 5 minutos, el webhook debe responder `{"received": true}` inmediatamente antes de procesar para evitar Timeouts.
- **Transacciones Concurrentes**: Si muchas llamadas terminan al mismo tiempo (simultaneidad alta), Supabase puede arrojar falsos bloqueos al hacer "UPDATE calls_completed = calls_completed + 1". Usar preferiblemente una función RDC (Postgres Function - RPC) en Supabase para el incremento seguro, o simplemente depender de un conteo en tiempo real desde el FrontEnd si la concurrencia es muy grande. Para empezar, un "UPDATE" en n8n servirá.
- **Estados Raros**: Si Retell envía estado "machine_detected", mapearlo a "buzon" en la base de datos local.
