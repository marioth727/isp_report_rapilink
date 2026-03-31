# Directiva: Actualización Masiva de Seriales ONU (SmartOLT -> WispHub)

## 1. Objetivo
Obtener el número de serie (SN) de las ONUs desde SmartOLT e insertarlo masivamente en el campo personalizado `sn onu` de los clientes correspondientes en WispHub. Esto permitirá tener visibilidad de la potencia de los equipos al revisar los tickets.

## 2. Entradas y Requisitos (APIs)
- **API SmartOLT**: Acceso para consultar el listado de ONUs registradas, extrayendo el SN y un dato identificador del cliente (IP, Nombre o ID de contrato).
- **API WispHub**: Acceso para consultar la base de clientes y realizar solicitudes de actualización (`PUT/PATCH`) sobre los campos personalizados.

## 3. Lógica de Emparejamiento (Matching)
Para actualizar al cliente correcto, necesitamos una llave primaria que exista en ambos sistemas:
- **Prioridad 1 (Recomendada):** Emparejamiento por **Dirección IP**.
- **Prioridad 2:** Emparejamiento por **ID del Cliente** (si WispHub y SmartOLT comparten el mismo ID).

## 4. Plan de Acción (Fases de Ejecución)

### Fase 1: Diagnóstico y Estructura (Observación)
1. Crear `scripts/diagnostico_smartolt_api.mjs`: Hacer una consulta mínima a SmartOLT para imprimir la estructura real ("Raw Log") del objeto ONU y confirmar dónde viene el serial.
2. Crear `scripts/diagnostico_wisphub_api.mjs`: Obtener un cliente de prueba en WispHub para analizar cómo se estructuran y envían los "campos adicionales" (`sn onu`).

### Fase 2: Prueba Aislada (Zero Trust)
3. Crear `scripts/sync_unica_onu.mjs`: 
   - Tomar **un solo cliente** de prueba.
   - Extraer su info de SmartOLT.
   - Preparar el payload para WispHub.
   - Imprimir en consola los flujos `[INTERNAL]`, `[MAPPING]`, `[REQUEST]` y `[RESPONSE]` antes de modificar nada en caliente.

### Fase 3: Ejecución Masiva y Segura
4. Crear `scripts/sync_masiva_onus.mjs`:
   - Descargar todo el mapa de ONUs de SmartOLT.
   - Iterar sobre los clientes de WispHub.
   - Respetar límites de peticiones (rate limiting / delay) para no ser bloqueados.
   - Escribir un archivo de resultados en `.tmp/reporte_sync_onus.json` con los éxitos y los clientes que no hicieron "match".

## 5. Trampas Conocidas y Restricciones
*(Se llenará conforme descubramos la estructura de datos real de las APIs y sus límites).*
- **Pendiente**: ¿Cómo maneja WispHub la paginación para miles de clientes?
- **Pendiente**: ¿Límites de peticiones por minuto en ambas plataformas?
