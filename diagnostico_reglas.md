# Reglas de Diagnóstico y Anti-Bucles (ISP Reports)

Estas reglas complementan el comportamiento general para asegurar que la depuración sea eficiente y no entre en bucles.

## 1. Protocolo Anti-Bucles
- **Aislamiento**: Crea un script en `scripts/` para reproducir errores aislados.
- **Hipótesis**: Explica la causa probable antes de intentar corregir.
- **Límite de 2 Intentos**: Si falla dos veces consecutivas, detente y pide intervención o replantea desde cero.
- **Validación de Datos**: No asumas estados; verifica BD y API con scripts de inspección.

## 2. Gestión de Scripts
- No crear archivos en la raíz; usar siempre `scripts/`.
- Usar nomenclatura `[accion]_[entidad].mjs`.
- Los scripts destructivos (que borran o editan masivamente) DEBEN tener un log de confirmación de los registros afectados.
