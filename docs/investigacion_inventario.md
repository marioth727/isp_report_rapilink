# Reporte de Investigación: Sistemas de Inventario para ISPs (v1.0)

Este documento compila las funcionalidades estándar de la industria y los requisitos específicos para integrar un módulo de inventario en la plataforma **ISP Reports App**.

## 1. Referencias del Mercado (Softwares Líderes)
Basado en sistemas como **Splynx, Sonar, y PowerCode**, las funcionalidades críticas son:

### A. Gestión de Activos Serializados
- **Seguimiento por Serial/MAC**: Fundamental para routers, ONTs y switches. Cada unidad es única.
- **Estado del Equipo**: Nuevo, Usado, Reparado, Dañado (Scrap).
- **Asignación Dinámica**: Vincular un serial específico a un Ticket de Instalación o a un Cliente.

### B. Control de Bodegas y Stock
- **Jerarquía de Almacenes**: Bodega Principal -> Bodega Secundaria -> Vehículo del Técnico.
- **Transferencias entre Bodegas**: Registro de movimiento de materiales de la oficina al carro del técnico.
- **Alertas de Stock Mínimo**: Notificaciones cuando los insumos (fibra, conectores) bajan de cierto umbral.

### C. Consumo en Terreno
- **Descuento Automático**: Al cerrar un ticket, el material usado se descuenta del inventario del técnico.
- **Validación de Instalación**: Escaneo (o ingreso manual) del serial instalado para activar el servicio.

## 2. Requisitos Técnicos para ISP Reports App

### Modelo de Datos (Sugerido para Supabase)
- `inventory_items`: Catálogo maestro de productos.
- `inventory_stock`: Cantidades por bodega/ubicación.
- `inventory_serials`: Tabla de unidades únicas con su historial.
- `inventory_transactions`: Log de auditoría de cada movimiento.

### Interfaz de Usuario (Estética Premium)
- **Dashboard de Stock**: Gráficos de barras con colores HSL para niveles de stock.
- **Buscador Universal**: Filtro rápido por serial o nombre de producto.
- **Vista de Técnico**: Interfaz simplificada para que el técnico vea qué lleva en su vehículo.

## 3. Preguntas para NotebookLM
1. ¿Cómo podemos optimizar el flujo de "Devolución de Equipos" cuando un cliente cancela el servicio?
2. ¿Qué métricas de inventario (KPIs) ayudarían más a reducir la pérdida de materiales en campo?
3. Dados los servicios existentes en `workflowService.ts`, ¿cuál es el mejor momento para disparar el descuento de inventario?

---
*Este reporte sirve como fuente primaria para el análisis en NotebookLM.*
