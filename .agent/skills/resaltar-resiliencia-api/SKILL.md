---
name: resaltar-resiliencia-api
description: Monitorea y diagnostica la salud de los endpoints de la API de WispHub. Úsese cuando ocurran errores 404, 500 o fallos de red inesperados en la integración externa.
---

# Resaltar Resiliencia API

## Cuándo usar esta skill
- Cuando un endpoint de WispHub devuelve 404 o 500.
- Durante la fase de inicialización de la app para verificar conectividad.
- Al detectar cambios en el comportamiento de la API externa.

## Flujo de trabajo
- [ ] Ejecutar script de diagnóstico de endpoints.
- [ ] Identificar endpoints caídos o movidos.
- [ ] Actualizar lista de fallbacks en `wisphub.ts`.
- [ ] Verificar si el error es persistente o temporal.

## Instrucciones
- Siempre prioriza el uso de la utilidad `safeFetch` con el flag `silent: true` para evitar ruido en la consola durante pruebas.
- Si un endpoint falla con 404, prueba variantes (con/sin barra final, v1/v2).
- Registra el fallo en la variable global de control para evitar reintentos infinitos en la sesión actual.

## Recursos
- `scripts/check_endpoints.mjs`: Script base para ping de salud.
