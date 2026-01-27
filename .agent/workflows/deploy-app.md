---
description: Verificación de build y preparación para despliegue (Production).
---

Este flujo asegura que la aplicación esté lista para ser subida a producción sin errores.

1. Limpiar caché y reinstalar dependencias (Si es necesario):
```powershell
rm -rf node_modules dist
npm install
```

2. Ejecutar el build de producción para detectar errores de TypeScript o Vite:
// turbo
```powershell
npm run build
```

3. Verificar variables de entorno de producción:
// turbo
```powershell
node scripts/debug_env.mjs
```

4. Despliegue manual (Instrucciones):
> [!IMPORTANT]
> Una vez que el build sea exitoso (`dist/` generado), sube los cambios a tu rama principal de GitHub para activar el despliegue automático en Vercel o Docker.
