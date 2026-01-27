# Análisis de Integración: SmartOLT + WispHub + Inventario

Para que el sistema de inventario sea infalible, debe cruzarse con la "vida real" de la red que proporciona **SmartOLT**.

## 1. El Triángulo de la Verdad
| Sistema | Rol en el Inventario | Dato Clave |
| :--- | :--- | :--- |
| **WispHub** | Gestión Comercial/Soporte | ID de Cliente, Estado del Servicio, Ticket de Trabajo. |
| **SmartOLT** | Gestión de Red (Capa Física) | Serial (SN), Señal (dBm), Estado (Online/Offline), Firmware. |
| **Inventario (Local)** | Gestión de Activos | Ubicación Física (Bodega/Técnico), Estado Contable (Nuevo/Dañado). |

## 2. Puntos de Apoyo de SmartOLT para el Inventario

### A. Validación de Instalación "Cero Errores"
Cuando el técnico cierra un ticket diciendo que instaló el router **SN: ABC123**:
1.  **Activación**: El sistema consulta la API de SmartOLT.
2.  **Verificación**: Si SmartOLT confirma que ese SN está "Online" en la OLT del sector, el inventario se descuenta automáticamente.
3.  **Seguridad**: Evita que un técnico registre un serial pero deje instalado otro diferente.

### B. Diagnóstico Automático de Activos Reparados
Al recuperar un equipo de un cliente (desinstalación):
- El sistema consulta el último reporte de señal en SmartOLT.
- Si el equipo tenía mala señal o errores de hardware, el inventario lo marca automáticamente como **"Requiere Revisión"** en lugar de "Disponible".

### C. Auditoría de "Equipos Fantasma"
Podemos correr un script que compare:
- **Lista A**: Equipos que SmartOLT dice que están encendidos en la red.
- **Lista B**: Equipos que nuestro inventario dice que están "En Bodega".
- **Resultado**: Si un equipo está encendido pero figura "En Bodega", hemos detectado una falla en la trazabilidad (alguien se llevó un equipo sin registrarlo).

## 3. Impacto en el Desarrollo
Agregaremos un servicio `src/lib/smartolt.ts` que se encargará de estas validaciones técnicas para que el Inventario no sea solo una lista de texto, sino un reflejo real de lo que pasa en la fibra óptica.
