# Resumen de Hallazgos - Creación de Respuestas en WispHub

## Objetivo
Crear burbujas de respuesta (como las verdes en la imagen) para eventos como:
- "El ticket ha sido iniciado por JAIME MARTINEZ"
- "Llegada al destino del ticket"
- "Ticket finalizado"

## Pruebas Realizadas

### ❌ Intento 1: POST a endpoints de comentarios/respuestas
```python
POST /api/tickets/{id}/comentarios/
POST /api/tickets/{id}/respuestas/
POST /api/tickets/respuestas/

Body: {
  "ticket": "66702",
  "comentario": "Mensaje...",
  "respuesta": "Mensaje..."
}

Resultado: 404 Not Found (endpoints no existen)
```

### ❌ Intento 2: PATCH a campo descripcion
```python
PATCH /api/tickets/{id}/
Body: {
  "descripcion": "descripcion_actual + nuevo_mensaje"
}

Resultado: 
- Status 200 (éxito)
- Descripción actualizada ✓
- Respuestas: 7 → 7 (sin cambio) ✗
- NO crea burbujas
```

## Conclusión

**NO existe forma conocida de crear burbujas de respuesta** con la API pública de WispHub.

## Pregunta para Ingenieros de WispHub

¿Cuál es el endpoint y payload correcto para crear respuestas/burbujas programáticamente?

**Necesitamos:**
1. URL del endpoint (ej: POST /api/tickets/{id}/???)
2. Campos requeridos en el body
3. Tipo de Content-Type (JSON o FormData)
4. Ejemplo de request exitoso

**Caso de uso:**
Queremos registrar eventos como "Ticket iniciado", "Llegada a sitio", "Ticket finalizado" 
que aparezcan como burbujas verdes en la interfaz de WispHub, tal como se muestra en:
[ADJUNTAR CAPTURA DE PANTALLA DE BURBUJAS VERDES]
