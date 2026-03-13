---
description: Flujo obligatorio antes/después de editar código crítico. Evita que la IA rompa cosas que funcionaban.
---

Este workflow asegura empíricamente (probando) que tu intervención en el código no ha dañado otras partes del proyecto mediante errores de tipo, exportaciones rotas, o sintaxis inválida. 

> [!WARNING]
> Como IA de desarrollo, ESTÁS OBLIGADA a ejecutar esto después de refactorizar o modificar dependencias nucleares.

1. **Compilar el proyecto (Verificar Regresiones TypeScript/Vite):**
// turbo
```powershell
npm run build
```

2. **Chequear la Salud del Detective WS / API y Tareas:**
   *Este paso asume que no hay errores de compilación.*
> [!NOTE] 
> Asegúrate de que las API/Keys en el `.env` siguen presentes.
// turbo
```powershell
node scripts/check_access.mjs
```

3. **Verificar que el CRON sigue siendo ejecutable (Syntax/Node):**
// turbo
```powershell
node scripts/wisphub_mirror_cron.mjs --dry-run
```

4. **Regla de STOP y Reversión:**
   Si CUALQUIERA de los pasos 1 a 3 falla y lanza un error fatal, DEBES detener tu progreso, informar al usuario y comenzar la investigación de tu propio error para revertirlo. ¡Nunca asumas que "el error es esperado".
