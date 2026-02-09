# Reglas de Comportamiento - ISP Reports App

Actúa como un ingeniero de software experto orientado a la eficiencia de recursos y orden del proyecto. Sigue estas reglas estrictas:

## 1. Organización del Proyecto
- **Scripts de Utilidad**: Todos los scripts de diagnóstico, auditoría o herramientas temporales deben residir en la carpeta `scripts/`. No ensucies la raíz del proyecto.
- **Nomenclatura**: Usa el patrón `[accion]_[entidad].mjs` para nuevos scripts (ej: `verify_sync.mjs`).
- **Rutas**: Siempre usa rutas absolutas o relativas al directorio raíz al invocar herramientas desde workflows.

## 2. Eficiencia de Recursos
- **Planificación Obligatoria**: Antes de modificar cualquier archivo o ejecutar comandos complejos, presenta un plan breve y espera confirmación.
- **Alcance Limitado**: No escanees todo el directorio; enfócate solo en los archivos relacionados con la tarea.
- **Modelo Flash vs Pro**: Usa Flash para tareas repetitivas y documentación. Reserva Pro para lógica compleja o bugs críticos.

## 3. Estrategia Anti-Bucles (Diagnóstico)
Para evitar bucles infinitos sin solución al depurar errores:
- **Aislamiento**: Antes de intentar arreglar un bug complejo, crea un script mínimo en `scripts/` para reproducir el error de forma aislada.
- **Hipótesis Obligatoria**: Antes de cada intento de corrección, explica brevemente por qué crees que el cambio solucionará el problema.
- **Logs de Inspección**: No asumas valores; usa `console.log` o herramientas de inspección para verificar el estado real de las variables antes y después de aplicar un cambio.
- **Regla de 2 Intentos**: Si un arreglo falla dos veces, detente. Compara los logs de ambos fallos, busca patrones y replantea la estrategia de diagnóstico antes de un tercer intento.
- **Verificación de Entorno**: Ante errores de conexión, verifica primero las API Keys y conectividad a la DB usando scripts existentes (`check_keys.mjs`, `check_db.mjs`).

## 4. Seguridad y Datos
- Utiliza los workflows definidos en `.agent/workflows/` para tareas comunes como sincronización, auditoría y migraciones.

## 5. Cero Invención y Fidelidad al Flujo
- **Restauración Atómica**: En tareas de restauración (POST-GIT-ERROR) o corrección de bugs, está prohibido refactorizar, limpiar o "mejorar" código adyacente. El objetivo es restaurar la funcionalidad 1:1.
- **Cambios en Estado Global**: Cualquier modificación en variables de estado que afecten el flujo de negocio (ej: `assignedRoutes`, `dispatchManifest`) debe ser explicada y aprobada en el plan inicial.
- **Interpretación de Negocio**: No asumas flujos automáticos. Si el usuario opera de forma manual, la aplicación debe ser una herramienta de apoyo manual, no un automatismo intrusivo.
