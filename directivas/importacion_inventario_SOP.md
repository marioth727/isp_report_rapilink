# SOP: Importación de Inventario desde Excel/CSV

Este documento define el procedimiento para migrar datos de inventario desde sistemas externos al ecosistema `isp-reports-app`.

## Objetivo
Garantizar la integridad de los datos de inventario (Categorías, Ítems y Activos) durante el proceso de carga masiva, evitando duplicados y errores de relación.

## Estructura de Datos Requerida (Mapeo)

| Campo Excel | Tabla Supabase | Descripción |
| :--- | :--- | :--- |
| **Categoría** | `inventory_categories` | Nombre del grupo (ej: Routers, ONU, Herramientas). |
| **Producto** | `inventory_items.name` | Nombre comercial del modelo. |
| **Marca** | `inventory_items.brand` | Marca del fabricante. |
| **Modelo** | `inventory_items.model_name` | Código del modelo. |
| **Serial** | `inventory_assets.serial_number` | Identificador único físico (SN). |
| **MAC** | `inventory_assets.mac_address` | Dirección física de red. |
| **Estado** | `inventory_assets.status` | Valores permitidos: `stock`, `assigned`, `rma`. |

## Modo Lite (Solo Nombre y Cantidad)

Si el archivo solo contiene `Nombre` y `Cantidad`, el procedimiento cambia para tratar los ítems como **no serializados**:

1.  **Item Creation**: Se crean en `inventory_items` con `is_serialized: false`.
2.  **Stock Initial**: Se crea un único registro en `inventory_assets` por cada producto con:
    - `status`: 'warehouse'
    - `quantity`: El valor de 'Cantidad disponible' del Excel.
    - `serial_number`: `LOTE-IMPORT-[FECHA]`

## Flujo de Operación

1.  **Limpieza del Excel**: Eliminar tildes o caracteres especiales en el "Nombre" si es posible.
2.  **Conversión a JSON**: Convertir el archivo a formato JSON (ej: utilizando una herramienta online).
3.  **Ejecución del Script**:
    - Usar `scripts/import_inventory_lite.mjs`.
4.  **Validación**: Revisar `Existencias y Entradas` en la App.

## Trampas Conocidas (Warnings)
- **Duplicidad de Seriales**: El script fallará si intenta insertar un serial que ya existe en la base de datos. Se debe limpiar el Excel de duplicados previamente.
- **Relación de Categorías**: Si el nombre de la categoría en el Excel varía (ej: "Routers" y "Router"), se crearán dos categorías diferentes. Se recomienda normalizar antes del paso 2.
- **Formato MAC**: Las direcciones MAC deben estar en formato estándar (ej: `AA:BB:CC...`).
