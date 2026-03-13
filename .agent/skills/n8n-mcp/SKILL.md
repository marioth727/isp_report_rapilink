---
name: gestionar-n8n-mcp
description: Interactúa con instancias de n8n a través del protocolo MCP. Úsese cuando el usuario solicite crear, ejecutar o auditar flujos de trabajo (workflows), manejar webhooks o consultar ejecuciones de n8n para Rapilink Voice AI.
---

# Gestión de n8n vía MCP

## Cuándo usar esta skill
- Cuando necesites desplegar los workflows de Rapilink Voice AI (Iniciar Campaña, Webhooks de Retell).
- Para depurar ejecuciones fallidas en n8n que afecten las llamadas de Sofía.
- Para verificar el estado de los webhooks de herramientas personalizadas (confirmar_upgrade, etc.).

## Flujo de trabajo
1.  **Exploración**: Lista los workflows existentes para evitar duplicados.
2.  **Configuración**: Asegúrate de que las credenciales de Supabase y Retell estén configuradas en n8n.
3.  **Despliegue**: Crea o actualiza los nodos necesarios (Webhook, Supabase, HTTP Request).
4.  **Activación**: Activa el workflow y realiza una prueba de "lazo cerrado" (llamada de prueba).

## Instrucciones Críticas (Protocolo Rapilink)
- **Cuerpo del Webhook**: SIEMPRE responder con JSON `{"response": "..."}` para que el agente de Retell no se quede en silencio.
- **Dynamic Variables**: Asegurarse de usar el campo `retell_llm_dynamic_variables` como un objeto plano, NO como un array.
- **Tiempos de Respuesta**: Los procesos pesados (como escribir en Supabase) deben ser asíncronos o responder al webhook inmediatamente antes de procesar para evitar el timeout de 10s de Retell.

## Recursos
- Servidor MCP: [n8n-mcp](https://github.com/czlonkowski/n8n-mcp.git)
- Repositorio local: `.agent/skills/n8n-mcp/repo/`
