---
name: auditar-estetica-premium
description: Garantiza que los componentes UI cumplan con los estándares de diseño premium (glassmorphism, micro-animaciones, paletas HSL). Úsese al crear nuevas páginas o componentes.
---

# Auditar Estética Premium

## Cuándo usar esta skill
- Al crear una nueva ruta o página en la aplicación.
- Cuando el usuario solicita mejorar el aspecto visual de una sección.
- Al refactorizar componentes antiguos de UI.

## Estándares de Diseño
- **Glassmorphism**: Uso de `backdrop-blur-md` y bordes semitransparentes (`border-white/10`).
- **Tipografía**: Títulos en `font-black`, tracking apretado (`tracking-tighter`).
- **Colores**: Evitar colores planos. Usar gradientes y opacidades (ej. `bg-primary/5`).
- **Interacción**: Todos los botones deben tener `active:scale-[0.98]` y `hover:opacity-90`.

## Instrucciones
- Revisa el archivo `tailwind.config.js` para asegurar coherencia con los tokens de diseño.
- Prioriza el uso de componentes existentes en `src/components/ui/` si están disponibles.
- Asegura que el modo oscuro sea la prioridad de diseño.

## Recursos
- `docs/ui_standards.md`: Guía de estilos del proyecto.
