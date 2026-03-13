# Ejemplo de Prompt para Módulo de Inventarios

Si el usuario preguntara: "Quiero un sistema para que los técnicos pidan materiales".

**El Prompt Optimizado sería:**

Actúa como un Senior FullStack Engineer. Tu tarea es diseñar e implementar el módulo de **"Solicitud de Materiales"** para ISP Reports App.

**Contexto Técnico:**
- React 19 + TypeScript.
- Base de datos Supabase: Requiere tabla `inventory_items` y `technician_requests`.
- Estética: Glassmorphism, modo oscuro preferido, botones con micro-interacciones.

**Requerimientos de Funcionalidad:**
1. Vista de catálogo de materiales disponibles con imágenes generadas por IA.
2. Carrito de solicitudes interactivo.
3. Botón de "Enviar Solicitud" que invoque una función de Supabase (Edge Function) para notificar al administrador.

**Restricciones:**
- No usar librerías externas de UI pesadas (usar Vanilla CSS + Tailwind v4).
- El estado de la solicitud debe ser en tiempo real (Supabase Realtime).

**Entrega:**
- Esquema SQL para las nuevas tablas.
- Componente `MaterialRequest.tsx`.
- Hook `useInventory` personalizado.
