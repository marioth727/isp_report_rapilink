---
name: automated-testing
description: Automatización completa del navegador con Playwright. Detecta servidores de desarrollo, escribe scripts de prueba limpios y ejecuta verificaciones de interfaz exhaustivas para ISP Reports App.
---

# Automatización de Navegador con Playwright

Habilidad de automatización general. Escribiré código de Playwright personalizado para cualquier tarea de prueba que solicites y lo ejecutaré de forma segura.

**FLUJO CRÍTICO - Sigue estos pasos en orden:**

1. **Auto-detectar servidores**: Para pruebas locales, SIEMPRE detecta si el servidor está corriendo primero.
2. **Scripts en /tmp**: NUNCA escribas archivos de prueba en la carpeta del proyecto; usa siempre `/tmp/playwright-test-*.js`.
3. **Navegador visible por defecto**: Usa siempre `headless: false` a menos que se pida específicamente lo contrario, para que puedas ver qué pasa.
4. **URLs parametrizadas**: Haz que las URLs sean configurables al inicio del script.

## Patrón de Ejecución
**Paso 1: Detectar servidores de desarrollo**
```bash
node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
```

**Paso 2: Escribir el script en /tmp**
**Paso 3: Ejecutar via Playwright**

## Solución de Problemas
**Playwright no instalado:**
```bash
npm install playwright
```
**El navegador no abre:**
Verifica `headless: false` y asegúrate de tener un entorno gráfico disponible.
