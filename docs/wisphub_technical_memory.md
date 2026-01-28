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

