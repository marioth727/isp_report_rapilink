---
description: Generación automática de tipos TypeScript desde el esquema de Supabase.
---

Este flujo asegura que el código TypeScript esté siempre sincronizado con la estructura de la base de datos.

1. Instalar dependencias si es necesario:
```powershell
npm install supabase --save-dev
```

2. Ejecutar la generación de tipos:
> [!IMPORTANT]
> Debes tener activo el CLI de Supabase o usar el comando remoto con tu ID de proyecto.

// turbo
```powershell
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/types/supabase.ts
```

3. Verificar que no haya errores de compilación tras la actualización:
// turbo
```powershell
npx tsc --noEmit
```
