# SOP: Gestión de Usuarios Supabase (Auth & Profiles)
> **ID:** DIRECTIVA-SUPABASE-AUTH-001
> **Fuente:** `docs/wisphub_technical_memory.md` (Sección 3)

## 1. Objetivo
Administrar la creación, sincronización y reparación de usuarios en Supabase (Auth + Public).

## 2. Trampas Conocidas (ZOMBIES 🧟)
> [!OneDoesNotSimply]
> **No insertar manualmente en `public.profiles`** sin crear el usuario en `auth.users`.
> Un usuario que existe en `public` pero no en `auth` es un "Zombie" y causará errores 500 en el login.

## 3. Procedimiento de Implementación

### Caso A: Nuevo Usuario
1.  **Nunca usar SQL directo:** No hacer `INSERT INTO profiles...`.
2.  **Usar RPC:** Llamar a la función `create_new_user` que maneja la transacción atómica.

### Caso B: Sincronización WispHub -> Supabase
1.  **Usar `update_user_credentials`:** Esta función RPC tiene lógica de "Auto-Sanación".
2.  **Verificar Integridad:** Después de sincronizar, correr script de auditoría.

## 4. Scripts de Verificación
- `scripts/audit_username_match.cjs` (Buscar huérfanos)
- `scripts/check_user.cjs` (Diagnosticar un usuario específico)
