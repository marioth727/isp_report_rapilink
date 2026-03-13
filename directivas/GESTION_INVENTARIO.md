# Directiva: Gestión de Inventario

## Objetivo
Mantener un control determinista y trazable de todos los activos de red (ONUs, Routers, Herramientas) desde su ingreso en bodega hasta su instalación o retiro.

## Estructura de Datos (Supabase)
- `inventory_items`: Catálogo general de productos (Ej: "ONU Huawei EG8145V5"). Define el stock mínimo.
- `inventory_assets`: Unidades físicas individuales con Serial Number (S/N) o MAC.
- `inventory_movements`: Registro histórico de traslados entre bodegas, técnicos y clientes.

## Estados de un Activo (`inventory_assets.status`)
1.  **`warehouse`**: Disponible en bodega principal.
2.  **`assigned`**: En poder de un técnico (pendiente de instalación).
3.  **`installed`**: Instalado en la casa de un cliente (vínculo con `servicio_id`).
4.  **`defective`**: Reportado con fallas (para proceso de RMA).
5.  **`recovered`**: Retirado de un cliente (debe pasar por revisión técnica antes de volver a `warehouse`).

## Reglas de Negocio (SOP)
- **Registro Único**: Todo activo debe tener un S/N o MAC único. No se permiten duplicados en `inventory_assets`.
- **Trazabilidad Obligatoria**: Cada cambio de estado debe generar un registro en `inventory_movements` con `origin_holder_id` y `destination_holder_id`.
- **Alertas de Stock**: Si `current_stock` < `min_stock_level` en `inventory_items`, se debe resaltar en rojo en el Dashboard.
- **Auditoría**: Periódicamente se debe realizar una "Toma Física" comparando el stock real con el de la base de datos.

## Trampas Conocidas (Memoria)
- *Error Común*: Asignar un equipo a un técnico sin actualizar el `holder_id`.
- *Restricción*: No se puede mover un equipo a `installed` si no tiene un `servicio_id` válido de WispHub.
