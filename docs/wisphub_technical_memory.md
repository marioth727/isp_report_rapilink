# Memoria Técnica: Integración WispHub y SmartOLT

> [!IMPORTANT]
> Este documento registra hallazgos críticos y decisiones de implementación técnica. Consúltelo antes de modificar la lógica de integración.

## 1. Integración SmartOLT

### Autenticación y Proxy
*   **Header**: `X-Token`
*   **Proxy Vite**: Las peticiones a `/api/smartolt/*` se redirigen a `https://rapilinksas.smartolt.com/api/*`.
*   **Seguridad**: La API Key se inyecta desde `VITE_SMARTOLT_API_KEY` en el proxy, nunca se expone en el cliente.

### Detección de Hardware (SN Normalization)
> [!WARNING]
> Los escáneres de códigos de barras/QR de las ONUs a menudo leen el Serial Number en formato **Hexadecimal Crudo** (16 caracteres), mientras que SmartOLT utiliza el formato **Vendor ID** (4 letras + 8 hex).

**Problema Identificado:**
- Escaneado: `43445443AFB334D1` (ZTE en hex)
- Esperado por SmartOLT: `CDTCAFB334D1`

**Solución Implementada:**
Se creó el método `SmartOLTService.normalizeSerialNumber(sn)` que detecta automáticamente si el input es un string hexadecimal de 16 caracteres y convierte los primeros 8 (4 bytes) a ASCII.
*   `43445443` -> `CDTC` + Resto `AFB334D1` = `CDTCAFB334D1`

### Lectura de Potencia Óptica (Real-Time Signal)
> [!NOTE]
> La API de SmartOLT tiene endpoints con comportamientos distintos respecto a la "frescura" de los datos.

**Endpoint de Detalles (Cached/Static):**
*   `GET /api/onu/get_onus_details_by_sn/{sn}`
*   **Uso**: Para obtener datos generales (Modelo, Zona, OLT).
*   **Limitación**: El campo `signal` suele venir vacío (`""`), en `0`, o con el último valor histórico conocido. **No fuerza una lectura en vivo.**

**Endpoint de Señal (Real-Time):**
*   `GET /api/onu/get_onu_signal/{unique_external_id}`
*   **Uso**: Para diagnóstico en tiempo real durante la instalación.
*   **Requisito**: Requiere el `unique_external_id` (ID interno numérico de SmartOLT), **NO** el SN.

**Flujo de Implementación (`SmartOLTService.getOnuSignal`):**
1.  Llamar a `verifyAssetStatus(sn)` para obtener el `unique_external_id` del equipo.
2.  Llamar a `get_onu_signal(id)` usando ese ID.
3.  Parsear el string de respuesta (ej: `"-24.31 dBm"` -> `-24.31`).

## 2. Integración WispHub

### Tickets y Asignación
*   WispHub asigna tickets de manera asíncrona.
*   Para garantizar consistencia local, usamos una lógica de "limpieza inteligente" que marca como cerrados (`CO`) aquellos tickets locales que ya no aparecen en la respuesta de la API de WispHub para el técnico actual.

### Instalaciones
*   El registro de instalaciones utiliza el endpoint `/api/wisphub/solicitudes-instalacion`.

### Bugs y Comportamientos de la API (Hallazgos)
> [!CRITICAL]
> **Campo Oculto de Técnico (`email_tecnico`)**: 
> Se descubrió que en ciertos tickets (especialmente instalaciones asignadas automáticamente), WispHub devuelve `tecnico: null` en el JSON principal, pero almacena la asignación real en el campo `email_tecnico` (ej: `instalaciones@rapilink-sas`).
>
> **Solución**: El `WisphubService` fue parcheado para buscar recursivamente:
> 1. Objeto `tecnico` estándar.
> 2. Si es null, buscar en `email_tecnico`.
> 3. Si `email_tecnico` contiene "instalaciones", se mapea visualmente a "INSTALACIONES".

## 3. Gestión de Autenticación y Usuarios (Supabase Auth)

### El Fenómeno de los Usuarios "Zombies" 🧟
> [!WARNING]
> Se detectó un estado crítico donde registros en `public.profiles` existían sin un homólogo válido en `auth.users`, o con registros corruptos en `auth.users` (campos `created_at`, `instance_id` o metadatos en `NULL`).

**Impacto:**
- Los usuarios son invisibles en el Dashboard de Supabase.
- El login falla con `500 Internal Server Error` (Database error querying schema) debido a que el servidor de Go no puede escanear valores `NULL` en columnas de tokens.

### Estrategia de "Resurrección" y "Auto-Sanación"
Se implementaron dos funciones RPC con privilegios de `SECURITY DEFINER` para gestionar esto desde el frontend sin exponer llaves de servicio:

1.  **`create_new_user`**: Crea el usuario en ambas tablas (`auth` y `public`) en una sola transacción atómica, evitando huérfanos.
2.  **`update_user_credentials` (v4)**: 
    - **Sincronización Total**: Se llama en cada guardado de configuración.
    - **Resurrección**: Si el usuario no existe en `auth.users`, lo crea usando el email del perfil.
    - **Auto-Sanación**: Si el registro existe pero está corrupto (es un "Zombie"), repara automáticamente los campos `created_at`, `instance_id` y metadatos obligatorios.

### Configuración de Seguridad (RLS)
*   La tabla `public.profiles` está protegida por RLS.
*   Solo los administradores o el propio usuario pueden modificar el perfil.
*   Las funciones RPC actúan como bypass controlado para operaciones que requieren privilegios de `auth.users`.

## 4. Filtrado Correcto de Tickets: Mapeo de Técnicos

> [!CRITICAL]
> **Fecha**: 2026-01-30  
> **Contexto**: Implementación de Filtro "Instalaciones Confirmadas" en `OperationsDispatch.tsx`

### Problema Detectado

Al intentar crear un método para cargar tickets específicos desde la API de WispHub, se descubrió que:

1. **La API NO devuelve `nombre_tecnico` directamente**: Este campo es generado por la función `mapTicket()` en el cliente.
2. **`mapTicket()` es la fuente de verdad**: Transforma campos crudos (`email_tecnico`, `tecnico`, `tecnico_asignado`) en un nombre legible consultando el caché de staff (`GLOBAL_STAFF_CACHE`).
3. **Nuevas consultas sin `mapTicket` devuelven `undefined`**: Si se crea un método nuevo en `WisphubService` que NO usa `mapTicket`, el campo `nombre_tecnico` quedará indefinido.

**Ejemplo del error:**
```typescript
// ❌ INCORRECTO: Método que NO usa mapTicket
async getTicketsByTechnician(techName: string) {
    const response = await fetch(`/api/tickets/?search=${techName}`);
    const data = await response.json();
    return data.results; // ← nombre_tecnico: undefined
}
```

**Comportamiento observado:**
- Tickets cargados por SWR (usando `mapTicket`): `nombre_tecnico: "INSTALACIONES"`
- Tickets cargados por método nuevo: `nombre_tecnico: undefined`
- Filtros del frontend comparaban contra `undefined` → Fallaban silenciosamente

### Solución Implementada

**Estrategia**: Usar los datos **YA mapeados** que fueron cargados por SWR, en lugar de hacer llamadas adicionales a la API.

```typescript
// ✅ CORRECTO: Filtrar tickets locales ya mapeados
const loadInstallationsTickets = async () => {
    setLoadingInstallations(true);
    try {
        // Usar tickets YA cargados (tienen mapeo correcto)
        const filtered = tickets.filter(t => {
            const tech = (t.nombre_tecnico || '').toLowerCase().trim();
            return tech === 'instalaciones@rapilink-sas' || 
                   tech === 'instalaciones aprobadas';
        });
        
        console.log(`✅ Instalaciones encontradas: ${filtered.length} tickets`);
        setFilterPill('Instalaciones');
    } finally {
        setLoadingInstallations(false);
    }
};
```

### Lecciones Aprendidas

1. **Siempre usar `mapTicket`**: Si creas un método nuevo en `WisphubService` que devuelva tickets, DEBE llamar `this.mapTicket(ticket)` antes de retornar.
   
2. **Preferir datos locales ya procesados**: Si los datos ya fueron cargados y mapeados (ej: por SWR), es más eficiente filtrarlos localmente que hacer nuevas llamadas a la API.

3. **Verificar tipos en interfaces**: Si un componente usa un campo (ej: `nombre_tecnico`), asegurarse de que la interfaz TypeScript lo declare (ej: `interface DispatchTicket { nombre_tecnico?: string; }`).

4. **Logging para debugging**: Logs como `[Service] nombre_tecnico: undefined` fueron clave para detectar el problema. Mantener logs descriptivos en métodos críticos.

5. **Variantes específicas para instalaciones**: El filtro de instalaciones usa solo **dos variantes** validadas en producción:
   - `'instalaciones@rapilink-sas'` (email crudo cuando no está en caché)
   - `'instalaciones aprobadas'` (variante de nombre mapeado)
   
   Estas dos variantes cubren todos los casos observados en el sistema WispHub real.

### Referencias de Código

- **Función de mapeo**: [`wisphub.ts:mapTicket`](file:///d:/desarrollo%20antgra/isp-reports-app/src/lib/wisphub.ts#L661-L835)
- **Filtro de instalaciones**: [`OperationsDispatch.tsx:Filtro Instalaciones Confirmadas`](file:///d:/desarrollo%20antgra/isp-reports-app/src/pages/OperationsDispatch.tsx#L319-L327)
- **Interfaz actualizada**: [`OperationsDispatch.tsx:DispatchTicket`](file:///d:/desarrollo%20antgra/isp-reports-app/src/pages/OperationsDispatch.tsx#L26-L50)

## 5. Consistencia de Datos Filtrados en Múltiples Vistas

> [!CRITICAL]
> **Fecha**: 2026-02-02  
> **Contexto**: Sincronización de Mapa con Filtros en `OperationsDispatch.tsx`

### Problema Detectado

Al implementar la sincronización visual entre el filtro de técnico y el mapa geográfico, se descubrió una **inconsistencia crítica en el origen de datos**:

1. **Pool de tickets** usaba `filteredTickets` (datos post-filtrado)
2. **Mapa (`ticketsByNeighborhood`)** usaba `tickets` (datos sin filtrar)
3. **Resultado**: El usuario filtraba por técnico "Juan", el pool mostraba solo tickets de Juan, pero **el mapa seguía mostrando TODOS los markers**

**Código problemático:**
```typescript
// ❌ INCORRECTO: Usaba tickets sin filtrar
const ticketsByNeighborhood = useMemo(() => {
    const grouped: Record<string, DispatchTicket[]> = {};
    
    tickets.forEach(ticket => { // ← Bug: tickets en lugar de filteredTickets
        // ...
    });
    
    return grouped;
}, [tickets, neighborhoods]);
```

**Síntoma observable:**
- Usuario selecciona técnico en dropdown → Pool actualiza correctamente
- Mapa **NO reacciona** → Muestra todos los barrios/markers
- UX confusa: Información inconsistente entre vistas

### Solución Implementada

**Principio**: Todas las vistas derivadas (pool, mapa, contadores) DEBEN usar la **misma fuente de datos filtrados**.

```typescript
// ✅ CORRECTO: Usa datos filtrados
const ticketsByNeighborhood = useMemo(() => {
    const grouped: Record<string, DispatchTicket[]> = {};
    
    filteredTickets.forEach(ticket => { // ← Fix: filteredTickets
        // ...
    });
    
    return grouped;
}, [filteredTickets, neighborhoods]); // ← Dependency correcta
```

**Impacto del fix:**
- Pool → usa `filteredTickets`
- Mapa → usa `ticketsByNeighborhood` (derivado de `filteredTickets`)
- Contadores → calculados desde `filteredTickets`
- **Resultado**: Todas las vistas sincronizadas ✅

### Cadena de Dependencias Correcta

```
filterTechId / showInstallations / searchQuery
              ↓
        filteredTickets (useMemo)
         ↓             ↓
    Pool de      ticketsByNeighborhood (useMemo)
    Tickets              ↓
                   Markers del Mapa
```

**Regla de oro**: Si una vista muestra un **subconjunto** de datos, debe derivarse de `filteredTickets`, NO de `tickets`.

### Bug Relacionado: Drag & Drop con Filtros

El mismo patrón de inconsistencia se manifestó en la funcionalidad de drag & drop:

**Problema:**
- `onDragEnd` usaba **índice del array** sobre `tickets` (sin filtrar)
- La UI mostraba `filteredTickets` (post-filtrado)
- Al arrastrar un ticket con filtro activo, se asignaba el ticket en `tickets[index]` en lugar del correcto en `filteredTickets[index]`

**Síntoma:** Usuario arrastra "Cliente A" → Sistema asigna "Cliente B" (ticket incorrecto).

**Solución:** Usar `draggableId` (que es `ticket.id`) para identificar el ticket, no el índice:

```typescript
// ❌ INCORRECTO: Usa índice
const [movedItem] = tickets.splice(source.index, 1);

// ✅ CORRECTO: Usa ID
const movedItem = filteredTickets.find(t => t.id === draggableId);
```

**Patrón general:** En drag & drop con datos filtrados, **siempre identificar items por ID único**, nunca por índice de array.

### Lecciones Aprendidas

1. **Verificar origen de datos en múltiples vistas**: Cuando tienes filtros, asegurarse de que TODAS las vistas (listas, mapas, gráficos) usen los datos filtrados.

2. **Dependencias de useMemo**: Al cambiar la fuente de datos en un `useMemo`, actualizar también el array de dependencias.

3. **Testing visual**: Los bugs de inconsistencia de datos son más evidentes cuando se usan **filtros restrictivos** (ej: filtrar por un técnico con pocos tickets).

4. **Logging para validación**: 
   ```typescript
   console.log(`📍 Mapa: ${totalMapped}/${filteredTickets.length} tickets`);
   ```
   Este tipo de logging ayuda a detectar discrepancias (ej: "Mapa: 50/10 tickets" sería una red flag).

### Referencias de Código

- **Fix aplicado**: [`OperationsDispatch.tsx:ticketsByNeighborhood`](file:///d:/desarrollo%20antgra/isp-reports-app/src/pages/OperationsDispatch.tsx#L331-L354)
- **Filtros que alimentan**: [`OperationsDispatch.tsx:filteredTickets`](file:///d:/desarrollo%20antgra/isp-reports-app/src/pages/OperationsDispatch.tsx#L284-L328)
## 6. Arquitectura del Centro de Despacho (Premium UI)

> [!IMPORTANT]
> **Fecha**: 2026-02-02  
> **Contexto**: Consolidación estética y funcional del Dashboard de Operaciones.

### Componentes de Interfaz "Bento"
La vista de despacho (`OperationsDispatch.tsx`) utiliza una arquitectura de capas:
1.  **Capa 0 (Mapa)**: Pantalla completa, tiles optimizados (`light_all`).
2.  **Capa 1 (Markers)**: `L.divIcon` personalizados con conteo de tickets y animación `animate-ping`.
3.  **Capa 2 (Widgets)**: Encabezado "CENTRO DE DESPACHO" con indicador "Live" pulsante y widgets de estadísticas con `backdrop-blur-3xl`.

### Solución de Visibilidad: Patrón de Portales
**Problema**: Los tickets desaparecían al salir de la barra lateral (clipping) debido a `overflow: hidden` en los padres.
**Solución**: Se implementó el componente `Portal` (usando `createPortal` de `react-dom`).
*   Cuando `snapshot.isDragging` es `true`, el ticket se despsrende de su contenedor y se renderiza en el `document.body`.
*   Se eliminan las transiciones (`transition-all`) durante el arrastre para evitar "lag" visual.
*   Z-index forzado a `9999` para visibilidad total.

### Blindaje de Diseño (Estética Premium)
- **Fuentes**: Uso agresivo de `font-[1000]` para títulos.
- **Identificación**: La C.C. del cliente siempre está en la cabecera del panel de detalles (`text-[10px] uppercase`).
- **Filtrado Dinámico**: El mapa DEBE reaccionar al filtro de técnico instantáneamente.
