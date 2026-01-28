# Memoria Técnica: Infraestructura y Despliegue (Dokploy)

> [!IMPORTANT]
> Esta sección documenta la arquitectura de despliegue personalizada para Dokploy. **NO MODIFICAR** los scripts de arranque (`start.sh` o `Dockerfile`) sin leer esto primero.

## 1. Arquitectura de Servidor (Nginx Proxy)

A diferencia del entorno local (`npm run dev`), en producción utilizamos **Nginx** por dos razones críticas:
1.  **Rendimiento:** Sirve archivos estáticos (React build) mucho más rápido que Node.js.
2.  **Seguridad (Proxy):** Actúa como intermediario para las APIs de WispHub y SmartOLT, inyectando las API Keys en el servidor para que **nunca** sean expuestas al navegador del cliente.

```mermaid
graph LR
    Client[Navegador Cliente] -->|HTTPS| Nginx[Nginx (Dokploy Container)]
    Nginx -->|Sirve Static| React[React App (Dist)]
    Nginx -->|Proxy + API KEY| WispHub[API WispHub]
    Nginx -->|Proxy + API KEY| SmartOLT[API SmartOLT]
```

## 2. Inyección de Variables (Custom Entrypoint)

### El Problema de `envsubst`
La imagen estándar de Nginx usa `envsubst` para inyectar variables de entorno en la configuración. Sin embargo, esto causa un conflicto grave con la sintaxis de variables de Nginx (ej: `$uri`), rompiendo la navegación de React (Error 404) al intentar reemplazar variables que no existen en el entorno.

### La Solución: Motor de Arranque Manual (`start.sh`)
Hemos implementado un script de arranque personalizado (`start.sh`) y desactivado el mecanismo automático.

**Flujo de Arranque:**
1.  El contenedor inicia ejecutando `/start.sh` (definido como `ENTRYPOINT/CMD` en Dockerfile).
2.  El script verifica la presencia de las variables críticas:
    - `VITE_WISPHUB_API_KEY`
    - `VITE_SMARTOLT_API_KEY`
3.  Usa `sed` para realizar un **Reemplazo Quirúrgico**:
    - Busca marcadores explícitos: `__VITE_WISPHUB_API_KEY__`
    - Los reemplaza por el valor real de la variable de entorno.
4.  Inicia Nginx en primer plano.

### Mantenimiento
Si necesitas agregar una nueva variable de entorno para inyectar en Nginx:

1.  **Dockerfile:** Asegúrate de que `start.sh` se copie y tenga permisos `chmod +x`.
2.  **nginx.conf:** Usa el placeholder con doble guión bajo: `__MI_NUEVA_VAR__`.
3.  **start.sh:** Agrega la línea de reemplazo:
    ```bash
    sed -i "s|__MI_NUEVA_VAR__|$MI_NUEVA_VAR|g" /etc/nginx/conf.d/default.conf
    ```

## 3. Caché de Docker (Troubleshooting)

Dokploy/Docker a veces cachea agresivamente las capas de construcción. Si haces un cambio en `nginx.conf` y no se refleja:

1.  Edita el `Dockerfile`.
2.  Cambia el valor de la variable `CACHE_BUST`:
    ```dockerfile
    ENV CACHE_BUST=2026-MM-DD-VERSION-NUEVA
    ```
3.  Esto forzará a Docker a reconstruir todas las capas subsiguientes.

## 4. Base de Datos (Supabase Production)

### Extensiones Requeridas
Para el funcionamiento correcto de la autenticación y encriptación de usuarios, la base de datos de producción **DEBE** tener habilitada la extensión `pgcrypto`.

**Error Típico:**
`function gen_salt(unknown) does not exist`

**Solución:**
Ejecutar en SQL Editor de Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```
