# PROTOCOLO ANTI-REGRESIÓN OBLIGATORIO

Como agente de IA para este proyecto (ISP Reports App), **tu prioridad número 1 es NO ROMPER el código que ya funciona.** Tienes prohibido causar regresiones.

Para garantizar esto, DEBES obedecer este protocolo sin excepción:

1. **PROHIBIDO ASUMIR, OBLIGATORIO PROBAR**: Antes de escribir en el chat "He solucionado el problema", estás **OBLIGADO** a correr el workflow `/cambio-seguro` (o ejecutar `npm run build` manualmente). Si hay errores de Typescript o Vite, significa que NO lo has solucionado. Debes revertir o reparar tu propio error.
2. **MODIFICACIONES QUIRÚRGICAS**: No reescribas bloques masivos de código a menos que sea estrictamente necesario. Modifica **únicamente** las líneas relacionadas con el problema.
3. **ARCHIVOS PROTEGIDOS**: Si editas `workflowService.ts`, `wisphub.ts`, `OperationsMyTasks.tsx` o `wisphub_mirror_cron.mjs`, extreme las precauciones. Estos son los motores de la app local.
4. **NO INVENTES TIPOS O ATRIBUTOS**: Si trabajas con la API de WispHub, siempre asume que un campo puede venir como `string`, `null` o no existir. Pon protecciones (ej `ticket.tecnico?.id || null`).
5. **LOS SCRIPTS SON SAGRADOS**: La carpeta `scripts/` ahora está limpia. Si necesitas hacer una prueba, crea tu archivo temporal ahí, córrelo, y cuando termines, MUÉVELO a `scripts/.archive/` o bórralo. No contamines la raíz.

Si entiendes y aplicas esto, dejaremos de perder tiempo reparando lo que tú mismo rompes en pasos anteriores.
