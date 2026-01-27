# Documentación Técnica: Sincronización de Tickets (Mis Tareas)

**Fecha:** 18 de Enero de 2026
**Módulo:** Gestión de Operaciones (Tickets)

## 1. Mapa de Archivos (El Camino del Dato)

Estos son los archivos críticos que intervienen en el ciclo de vida de la sincronización, en orden de ejecución:

| Orden | Archivo (Ruta Absoluta) | Responsabilidad |
| :--- | :--- | :--- |
| **1 (UI)** | `src/pages/OperationsHub.tsx` (o `OperationsMyTasks.tsx`) | Contiene el botón **"Sincronizar Ahora"** (Rápida o Profunda). Invoca al servicio. |
| **2 (Lógica)** | `src/lib/workflowService.ts` | **CEREBRO DEL SISTEMA.** Orquesta la descarga, comparación, lógica de negocio y guardado en BD. |
| **3 (API)** | `src/lib/wisphub.ts` | Encargado de hablar con WispHub (HTTP GET). Contiene la corrección de CORS y Proxy. |
| **4 (Persistencia)** | `src/lib/supabase.ts` | Cliente de conexión a la base de datos local (PostgreSQL). |
| **5 (Vista)** | `src/components/dashboard/TicketTimeline.tsx` | Renderiza los tickets (WorkItems) una vez guardados en la base de datos. |

---

## 2. Flujo de Datos (Data Flow) - Paso a Paso

Cuando el usuario hace clic en **"Sincronizar (60 días)"**, ocurre lo siguiente:

### Paso 1: Petición a WispHub
El archivo `wisphub.ts` ejecuta una petición GET a la API externa.
*   **Endpoint:** `https://api.wisphub.io/api/tickets/`
*   **Parámetros Clave:**
    *   `limit`: 30 o 5 (según tipo de sync).
    *   `fecha_creacion_0`: Calculada dinámicamente (hace 60 días).
*   **Seguridad:** Se inyecta el header `Authorization: Api-Key ...`.

### Paso 2: Procesamiento y "Matching" (El Núcleo)
El archivo `workflowService.ts` recibe la lista de tickets "crudos" y, por cada uno, ejecuta la función `syncSingleTicket`. Aquí es donde se decide **a qué técnico local pertenece el ticket**.

#### 🧬 El Algoritmo de Coincidencia (`isMatch`)
Este es el código EXACTO que se está ejecutando actualmente en producción para vincular WispHub con tu Base de Datos:

```typescript
const isMatch = (t: any, profile: any) => {
    // Normalización: Quitar acentos, minúsculas, espacios
    const normalize = (s: any) => (s || '').toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    
    // Datos del Perfil Local (Supabase)
    const pWhId = normalize(profile.wisphub_id);
    const pEmail = normalize(profile.email);
    const pName = normalize(profile.full_name);

    // Datos del Ticket (WispHub)
    let tUser = normalize(t.tecnico_usuario || '');
    let tName = normalize(t.nombre_tecnico || '');
    const tEmail = normalize(t.email_tecnico || '');

    // 🩹 PARCHE PARA API INCOMPLETA:
    // Si WispHub envía el técnico como texto simple (string) en vez de objeto,
    // lo capturamos aquí para poder buscarlo por nombre.
    if (!tUser && !tName && t.tecnico && typeof t.tecnico === 'string') {
        tName = normalize(t.tecnico);
    }

    if (!pWhId && !pEmail && !pName) return false;

    // Regla 1: Coincidencia Exacta de Usuario (Prioridad Máxima)
    if (tUser && pWhId && tUser === pWhId) return true;
    if (tUser && pEmail && tUser === pEmail) return true;

    // Regla 2: Coincidencia Exacta de Nombre Real
    if (tName && pName && tName === pName) return true;

    // Regla 3: Coincidencia por Email
    if (tEmail && pEmail && tEmail === pEmail) return true;

    // Regla 4: Coincidencia Inteligente Parcial ("Smart Match")
    // Permite que "Mario" coincida con "Mario Vasquez" o "Cristobal Martinez"
    if (tName && pName) {
        if (tName.includes(pName) || pName.includes(tName)) {
            // Requiere al menos 4 letras para evitar falsos positivos
            if (tName.length >= 4 && pName.length >= 4) return true;
        }
        // Coincidencia palabra por palabra
        const tWords = tName.split(' ');
        const pWords = pName.split(' ');
        const hasCommonWord = tWords.some((tw: string) => tw.length > 3 && pWords.includes(tw));
        if (hasCommonWord) return true;
    }

    return false;
};
```

### Paso 3: Persistencia en Base de Datos (Supabase)
Una vez identificado el técnico (`targetParticipantId`), el sistema guarda la información usando una estrategia de **"Upsert Forzado"**:

1.  **Actualizar Proceso (Ticket):** Se actualiza la tabla meta `workflow_processes` con el nombre del técnico.
2.  **Resurrección de Zombies:** Si el ticket está "Abierto" en WispHub pero "Cerrado" localmente, se fuerza el estado a `PE` (Pendiente).
3.  **Reasignación de Tarea (WorkItem):**
    *   Se busca cualquier tarea pendiente asociada a ese ticket.
    *   Se ejecuta un `UPDATE` masivo sobrescribiendo el campo `participant_id` con el ID del técnico encontrado.

---

## 3. Estado Actual del "Matching"

| Escenario | Comportamiento Actual |
| :--- | :--- |
| **Usuario existe en BD** y coincide ID WispHub | ✅ **Match Perfecto.** Asignación inmediata. |
| **Usuario existe en BD** y coincide Email | ✅ **Match por Email.** Asignación correcta. |
| **WispHub envía solo nombre** ("Cristobal Martinez") | ✅ **Smart Match.** El sistema busca ese nombre textualmente en tu BD. Si existe un perfil "Cristobal Martinez", se le asigna. |
| **Nombre incompleto** ("Mario") | ✅ **Smart Match Estricto.** Si coincide una palabra de >3 letras con un perfil ("Mario Vasquez"), se asigna. |
| **Usuario NO existe en BD** | ⚠️ **Huérfano Identificado.** El ticket se guarda, pero queda asignado al nombre en texto plano ("Mario"). No aparecerá en "Mis Tareas" de nadie hasta que se cree el perfil. |

---

## 4. Esquema de Base de Datos Relacionado

Estas son las dos tablas que deben "hablarse" para que el sistema funcione.

### Tabla: `profiles` (Tus Técnicos)
Representa a los usuarios logueados en la App.
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,          -- ID interno de Supabase (El que usamos para asignar)
  wisphub_id TEXT,              -- Username de WispHub (ej: 'sistemas@rapilink-sas')
  full_name TEXT,               -- Nombre real (ej: 'Mario Vasquez')
  email TEXT                    -- Correo electrónico
);
```

### Tabla: `workflow_workitems` (Las Tareas)
Representa la tarea que aparece en la bandeja de entrada.
```sql
CREATE TABLE workflow_workitems (
  id UUID PRIMARY KEY,
  activity_id UUID,             -- Enlace al Ticket padre
  status TEXT,                  -- 'PE' (Pendiente) o 'CO' (Completado)
  participant_id TEXT           -- <--- CAMPO CLAVE
                                -- Aquí se guarda el UUID del perfil encontrado.
                                -- Si este campo no coincide con el ID de 'profiles', la tarea no se ve.
);
```
