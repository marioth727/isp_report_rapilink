---
name: detectar-integridad-datos
description: Audita y limpia discrepancias entre la base de datos local (Supabase) y la API externa. Úsese cuando el usuario reporte tickets duplicados, fantasma o mal asignados.
---

# Detectar Integridad de Datos

## Cuándo usar esta skill
- Cuando aparecen tickets "duplicados" en el Dashboard.
- Si un técnico reporta que ve tickets que no le pertenecen.
- Al realizar una sincronización masiva para purgar registros antiguos.

## Flujo de trabajo
- [ ] Ejecutar script de comparación API vs DB.
- [ ] Identificar registros locales que ya no existen en WispHub.
- [ ] Verificar la asignación (tecnico_id) del registro contra el perfil Supabase.
- [ ] Proponer purga selectiva de registros corruptos.

## Instrucciones
- Nunca borres datos masivamente sin un backup o confirmación previa.
- Usa el criterio de "Propiedad Estricta": si el técnico en WispHub cambió, el registro local debe ser reasignado o purgado.
- Registra las discrepancias encontradas en un log temporal antes de actuar.

## Recursos
- `scripts/audit_data_integrity.mjs`: Compara ID de WispHub con registros de Supabase.
