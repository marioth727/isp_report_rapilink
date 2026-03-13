# SOP: Integración SmartOLT (Hardware & Señales)
> **ID:** DIRECTIVA-SMARTOLT-001
> **Fuente:** `docs/wisphub_technical_memory.md` (Sección 1)

## 1. Objetivo
Gestionar cualquier cambio relacionado con la lectura de ONUs, señales ópticas o detección de hardware.

## 2. Trampas Conocidas (LEER ANTES DE CODIFICAR)
> [!WARNING]
> **Serial Numbers:** Los lectores de códigos de barras devuelven 16 caracteres HEX. SmartOLT usa VendorID (4 letras) + 8 HEX.
> **Señales:** El endpoint de "detalles" tiene caché. El de "señal" es real-time pero requiere ID numérico, no SN.

## 3. Procedimiento de Implementación

### Caso A: Lectura de Seriales (Input)
1.  **Validar Input:** ¿El usuario está escaneando con pistola o escribiendo?
2.  **Usar Normalizador:** SIEMPRE pasar el input por `SmartOLTService.normalizeSerialNumber(sn)`.
    - *Prueba:* `43445443AFB334D1` debe convertirse en `CDTCAFB334D1`.

### Caso B: Consulta de Potencia (Signal)
1.  **No usar Cache:** Nunca confiar en el campo `signal` de `get_onus_details_by_sn`.
2.  **Flujo Obligatorio:**
    - Paso 1: `verifyAssetStatus(sn)` -> Obtener `unique_external_id`.
    - Paso 2: `get_onu_signal(id)` -> Obtener señal en vivo.
3.  **Timeout:** La petición puede tardar. Implementar `timeout` de 10s y manejo de error visual.

## 4. Scripts de Verificación
- `scripts/check_real_signal.mjs` (Probar lectura en vivo)
- `scripts/test_sn_normalization.js` (Probar lógica de conversión)
