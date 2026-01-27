# Reporte de Estado Actual (Handover)

**Fecha:** 18 de Enero de 2026
**Proyecto:** ISP Reports App (Gestión de Tickets y CRM)

## 1. Resumen de Arquitectura

El proyecto es una **Single Page Application (SPA)** moderna optimizada para rendimiento y experiencia de usuario.

### Stack Tecnológico
*   **Frontend Framework:** React 19 (Hooks, Functional Components)
*   **Build Tool:** Vite 7.2.4 (Hot Module Replacement instantáneo)
*   **Lenguaje:** TypeScript ~5.9.3 (Tipado estricto)
*   **Estilos:** Tailwind CSS v4 (Utility-first framework)
*   **Iconos:** Lucide React
*   **Backend / Base de Datos:** Supabase (PostgreSQL + Auth + Realtime)
*   **Cliente HTTP:** Fetch API con wrapper custom `safeFetch` (Proxies locales para evitar CORS)
*   **Integraciones:** WispHub API (Sincronización de tickets y usuarios)

### Directorios Clave
```
/src
├── components
│   ├── crm          # Componentes de Gestión de Clientes (InteractionForm, History)
│   ├── dashboard    # Gráficos de productividad y KPIs (TicketTimeline, Workload)
│   ├── layout       # Estructura base (Sidebar, Header, Layout)
│   └── ui           # Componentes base reutilizables (Botones, Modales, Inputs)
├── lib
│   ├── supabase.ts      # Cliente de conexión a BD
│   ├── wisphub.ts       # Servicio de integración con API externa
│   └── workflowService.ts # Lógica CORE de sincronización y asignación de tareas
├── pages            # Vistas principales (Routing)
│   ├── OperationsHub.tsx    # Panel principal de Operaciones
│   └── OperationsMyTasks.tsx # Bandeja de entrada del técnico
└── types            # Definiciones de TypeScript (Modelos de datos)
```

## 2. Estado de los Tickets vs "Inventario ISP"

⚠️ **ALERTA CRÍTICA:** Este repositorio está enfocado casi exclusivamente en **CRM y Gestión de Tickets (Workflow)**. No se encontró código relacionado con el módulo de Inventarios que mencionas.

| Funcionalidad / Módulo | Estado | Ubicación / Notas |
| :--- | :--- | :--- |
| **Gestión de Tickets** | ✅ **100% Codificado** | `src/lib/workflowService.ts` |
| **Sincronización WispHub** | ✅ **100% Codificado** | Soporta Sync 60 días y "Resurección de Zombies". |
| **CRM / Interacciones** | ✅ **100% Codificado** | `src/pages/InteractionLog.tsx` |
| **Tabla de Técnicos** | ✅ **Codificado** | Se gestiona vía `profiles` en Supabase. |
| **Tabla de Materiales** | ❌ **NO EXISTE** | No hay tablas ni vistas de productos/stock. |
| **Formulario de Entrega** | ❌ **NO EXISTE** | No hay lógica de movimientos de inventario. |
| **Historial Transacciones**| ❌ **NO EXISTE** | No hay registro de entradas/salidas de material. |

> **Conclusión:** Si el "Inventario ISP" debía estar aquí, **no se ha migrado ni desarrollado aún**. El proyecto actual es puramente operativo (Tickets y Gestión Comercial).

## 3. Esquema de Base de Datos (Reconstruido)

El esquema actual soporta el flujo de trabajo de tickets y CRM. "Materiales" y "Transacciones" **no están presentes** en el modelo de datos actual.

```sql
-- 1. PERFILES (Usuarios del sistema)
TABLE profiles (
  id UUID PRIMARY KEY,
  wisphub_id TEXT,       -- ID de WispHub para mapeo
  full_name TEXT,
  email TEXT,
  role TEXT              -- 'tecnico', 'admin', 'comercial'
);

-- 2. WORKFLOW (Gestión de Tickets)
TABLE workflow_processes (
  id UUID PRIMARY KEY,
  reference_id TEXT,     -- ID del Ticket en WispHub
  process_type TEXT,     -- 'Ticket AXCES', etc.
  status TEXT,           -- 'PE' (Pendiente), 'CO' (Completado)
  metadata JSONB         -- Guarda technician_name, last_sync_at, etc.
);

TABLE workflow_activities (
  id UUID PRIMARY KEY,
  process_id UUID REFERENCES workflow_processes(id),
  name TEXT,             -- 'Diagnóstico', 'Solución'
  status TEXT            -- 'Active', 'Completed'
);

TABLE workflow_workitems (
  id UUID PRIMARY KEY,
  activity_id UUID REFERENCES workflow_activities(id),
  participant_id TEXT,   -- USUARIO ASIGNADO (Aquí ocurre la magia del sync)
  status TEXT            -- 'PE', 'CO'
);

-- 3. CRM (Gestión Comercial)
TABLE crm_interactions (
  id UUID PRIMARY KEY,
  client_reference TEXT,
  result TEXT,           -- 'Aceptó Migración', 'Rechazó'
  created_at TIMESTAMP
);
```

## 4. Problemas Actuales y Ejecución

### Estado de Salud
*   **Compilación:** ✅ Estable. No hay errores de TypeScript o Build activos tras las últimas correcciones (se eliminaron variables no usadas).
*   **Sincronización:** ✅ Corregida. El bug de "tickets invisibles" (por rango de fecha o nombres incompletos como "Mario") ha sido solucionado con la nueva lógica *Smart Match* y *Zombie Resurrection*.

### Cómo iniciar el proyecto
Para levantar el entorno de desarrollo localmente:

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```
2.  **Iniciar Servidor (Vite):**
    ```bash
    npm run dev
    ```
    > El servidor iniciará en `http://localhost:5173`.
    > Asegúrate de que el archivo `.env` tenga las llaves `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `WISPHUB_API_KEY`.

---
**Nota para el Revisor:** El código de "Inventario" debe ser portado o desarrollado desde cero, ya que este repositorio está limpio y especializado únicamente en la Operación de Servicio y Ventas.
