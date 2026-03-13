---
name: desplegar-dokploy
description: Configura el proyecto para despliegue en producción usando Dokploy (Docker + Nginx).
version: 1.0.0
---

# Despliegue en Dokploy (Docker + Nginx)

Esta skill configura tu aplicación React/Vite para ser desplegada en un servidor Dokploy. Utiliza un enfoque "Multi-Stage Build" para generar una imagen Docker ligera y de alto rendimiento.

## Archivos Generados

### 1. `Dockerfile`
Define cómo se construye la aplicación.
- **Stage 1 (Build):** Usa Node.js para instalar dependencias y compilar el proyecto (`npm run build`).
- **Stage 2 (Production):** Usa Nginx (Alpine) para servir los archivos estáticos generados.

### 2. `nginx.conf`
Configuración del servidor web para manejar aplicaciones SPA (Single Page Applications).
- Redirige todas las rutas (ej: `/inventario`) al `index.html` para que React Router funcione.
- Configura compresión Gzip para mayor velocidad.

## Instrucciones de Despliegue

1.  **Variables de Entorno:**
    Asegúrate de agregar las siguientes variables en el panel de Dokploy (Environment Variables):
    - `VITE_SUPABASE_URL`: Tu URL de Supabase.
    - `VITE_SUPABASE_ANON_KEY`: Tu clave pública de Supabase.

2.  **Push a GitHub:**
    Simplemente sube tus cambios al repositorio:
    ```bash
    git add .
    git commit -m "chore: setup dokploy deployment"
    git push origin main
    ```

3.  **Dokploy:**
    Si tienes configurado el despliegue automático, Dokploy detectará el `Dockerfile` y comenzará el proceso.

## Notas Importantes
- **No se requiere `server.js`:** La aplicación se sirve como archivos estáticos puros, lo que es mucho más seguro y rápido que correr un servidor Node.js en producción para el frontend.
- **Caché:** Nginx está configurado para manejar caché de archivos estáticos eficientemente.
