# SOP: ESTÉTICA Y DISEÑO FRONTEND PREMIUM
> **ID:** DIRECTIVA-009
> **Autor:** Agente Antigravity
> **Fecha:** 2026-02-26

## 1. Objetivo
Garantizar que cada componente e interfaz de la aplicación "isp-reports-app" cumpla con estándares de diseño modernos, premium y profesionales, evitando resultados genéricos o básicos.

## 2. Insumos y Prerrequisitos
- [ ] Tailwind CSS (configurado en el proyecto)
- [ ] Lucide React (para iconos)
- [ ] Fuente "Inter" o "Outfit" cargada desde Google Fonts

## 3. Reglas Maestras de Diseño

1.  **Paleta de Colores (Zero Generic):**
    - Prohibido usar `red-500`, `blue-500` puro.
    - Usar escalas de grises azulados o slate para fondos.
    - Usar colores de acento vibrantes pero armoniosos (ej. Indigo, Emerald, Rose).
2.  **Glassmorphism (Efecto Cristal):**
    - Los modales y paneles laterales deben usar `backdrop-blur-md` y fondos con opacidad (ej. `bg-white/80` o `bg-slate-900/80`).
    - Bordes sutiles con `border border-white/20`.
3.  **Micro-animaciones:**
    - Cada botón interactivo DEBE tener un `transition-all` y efectos de `hover:scale-105` o `hover:shadow-lg`.
    - Las entradas de listas deben aparecer con un ligero fade-in o slide.
4.  **Tipografía:**
    - Jerarquía clara con `font-bold` para títulos y `font-medium` para labels.
    - Espaciado generoso (`tracking-tight` para títulos).

## 4. Trampas Conocidas (Casos Borde)
- **No sobrecargar el blur.** En dispositivos móviles antiguos, el `backdrop-blur` puede ralentizar la UI. Si se detecta lentitud, usar fondos sólidos.
- **Contraste RLS.** Asegurar que los colores dinámicos (estados de tickets) tengan suficiente contraste sobre fondos oscuros.

## 5. Criterios de Éxito
- La interfaz se siente "viva" al interactuar.
- El usuario percibe una calidad superior a un MVP estándar.
- No hay inconsistencias visuales entre diferentes páginas.
