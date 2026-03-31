# SOP: Liquidación Inteligente e Inventario en Vivienda (Tickets Fantasma)

## 🎯 Objetivo
Eliminar la discrepancia de inventario cuando un técnico instala material en un domicilio pero no logra cerrar el ticket el mismo día, evitando que el ticket se convierta en un "fantasma" sin rastro de los equipos.

---

## 🏗️ Lógica de Operación

### 1. El Cierre de Tarde (Liquidación de Retorno)
Al momento de generar el **Acta de Liquidación**, el sistema ejecutará un **Triple Check**:
1.  **Material Consumido:** ¿Qué equipos y metros de cable reportó el técnico en sus tareas de hoy?
2.  **Estado del Ticket (WispHub):** ¿Esos tickets están en estado `4 (Cerrado)`?
3.  **Detección de "Material en Vivienda":**
    - Si el material fue reportado pero el ticket está en estado `1 (Abierto)` o `2 (En Progreso)`, el sistema lo marcará como **"RESERVADO EN VIVIENDA"**.
    - El acta de liquidación permitirá el cierre físico (devolver lo que sobró en el maletín) sin reportar faltantes, siempre que el técnico confirme que el equipo quedó instalado en el domicilio del cliente.

### 2. El Inicio de Día (Bandeja de Tareas)
Los tickets que quedaron con "Material en Vivienda" de ayer recibirán el siguiente tratamiento:
- **Prioridad Máxima:** Aparecerán en el **Top 1** de la lista (por encima de los de hoy).
- **Badge Visual:** Etiqueta distintiva `[PENDIENTE CIERRE / MATERIAL EN VIVIENDA]`.
- **Bloqueo de Nuevo Material:** El técnico no podrá asignar *otro* equipo serializado al mismo ticket si ya tiene uno en "vivienda", obligándolo a cerrar el flujo actual.

---

## 🚫 Casos Borde y Advertencias (Trampas Conocidas)
- **Latencia de API:** WispHub puede tardar hasta 5 minutos en reflejar un cierre. El sistema debe permitir un "Reintento de Sincronización" antes de marcarlo como pendiente de ayer.
- **Pérdida Real:** Si el técnico dice que el material está "en vivienda" pero realmente lo perdió, el Administrador verá en el reporte de auditoría que el ticket lleva +24h sin cerrarse, lanzando una alerta de conciliación.
- **Cambio de Equipo:** Si el técnico instaló una ONU ayer (quedó en vivienda) pero hoy decide cambiarla por otra diferente, debe devolver la primera mediante un ajuste en el ticket para que el stock regrese a su maletín virtual.

---

## 📊 Auditoría para el Administrador
Se generará un reporte diario automático:
- **ID Técnico | Ticket | Material | Tiempo Transcurrido**
- Cualquier registro con >24 horas en "Vivienda" se considera una **Alerta de Inventario**.
