---
name: optimizar-prompt-engineering
description: Refina y estructura ideas del usuario en prompts técnicos de alta calidad optimizados para el desarrollo de ISP Reports App. Úsese cuando el usuario solicite ayuda para planificar una nueva funcionalidad o cuando se necesite una guía detallada para una implementación compleja.
---

# Optimizar Prompt Engineering

## Cuándo usar esta skill
- Cuando el usuario proporcione ideas vagas o desordenadas para una nueva funcionalidad.
- Antes de comenzar el desarrollo de un módulo complejo (ej. Inventarios).
- Para asegurar que los prompts generados sigan el stack técnico del proyecto (React 19, Vite, Supabase, Tailwind CSS v4).

## Flujo de Trabajo (Planificar-Validar-Ejecutar)

1.  **Extracción de Requisitos**: Identificar la entidad (ej. Producto), la acción (ej. Crear stock) y el contexto (ej. Perfil técnico).
2.  **Mapeo de Arquitectura**: Consultar `CURRENT_STATUS.md` para asegurar que el prompt incluya referencias a las tablas de Supabase y servicios existentes (`workflowService.ts`).
3.  **Generación de Estructura**: Crear un "Super Prompt" siguiendo la estructura de: Rol -> Contexto -> Tarea -> Restricciones -> Formato de Salida.
4.  **Validación de Salida**: Presentar el prompt al usuario en un bloque de código para su aprobación o edición manual.

## Plantilla de "Super Prompt" para el Proyecto

```markdown
### ROL
Actúa como un Senior FullStack Engineer experto en el ecosistema ISP Reports App.

### CONTEXTO DEL PROYECTO
- **Frontend**: React 19, TypeScript, Tailwind CSS v4.
- **Backend/DB**: Supabase (PostgreSQL).
- **Integración**: WispHub API (vía `src/lib/wisphub.ts`).
- **Estado Actual**: [Insertar resumen breve de CURRENT_STATUS.md].

### TAREA ESPECÍFICA
[Insertar idea refinada del usuario aquí]

### RESTRICCIONES TÉCNICAS
- Usar iconos de `lucide-react`.
- Seguir estándares estéticos premium (glassmorphism, micro-animaciones HSL).
- Implementar manejo de errores mediante `safeFetch`.
- Los datos externos deben validarse con Zod o tipos de TypeScript estrictos.

### FORMATO DE SALIDA ESPERADO
1. Plan de cambios (archivos a crear/modificar).
2. Código listo para producción.
3. Plan de verificación.
```

## Instrucciones Críticas
- **No asumas**: Si falta información del esquema de base de datos, pide al usuario que defina los campos primero.
- **Consistencia estética**: Todo prompt debe mencionar explícitamente el uso de variables de Tailwind configuradas en `index.css`.
- **Seguridad**: Siempre incluir instrucciones para definir políticas RLS en Supabase si se crea una nueva tabla.
