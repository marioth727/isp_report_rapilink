# Protocolo de Negocio: Centro de Despacho

Este documento define las reglas de oro para el comportamiento del componente `OperationsDispatch.tsx` y su integración con WispHub.

## 1. Regla de Oro: La Planificación es MANUAL
- **Cero Auto-Asignación**: No asumas que porque un ticket tiene un técnico en WispHub (Status 1 o 2), este deba aparecer automáticamente en la columna del técnico en la app.
- **Flujo de Trabajo**: Los tickets deben aparecer inicialmente en el **POOL** (lista izquierda). El usuario decide a qué técnico moverlos hoy.
- **Independencia del Backend**: La app es una capa de planificación estratégica; lo que el usuario mueve en la app es su "borrador de batalla" antes de publicar.

## 2. Persistencia y Borrador
- **Botón Borrador**: Las asignaciones hechas por el usuario deben persistir localmente (`localStorage`) solo cuando se presiona el botón "Borrador".
- **Limpieza**: No limpies el borrador automáticamente. El usuario debe tener control total sobre cuándo resetear su planificación.

## 3. Visibilidad de Trazabilidad (Timeline)
- **Filtro de Despacho**: Solo los tickets que han sido gestionados o "despachados" a través de esta aplicación en el día actual deben aparecer en el Timeline de trazabilidad.
- **Excepción**: Si un ticket se cierra externamente y no fue despachado desde la app, NO debe aparecer en el timeline de esta herramienta para mantener los indicadores limpios.

## 4. Integridad de Datos
- **Status de Tickets**: El Pool debe contener tickets en estado "Abierto" (1) y "En Progreso" (2) unificados, permitiendo que el despacho sea agnóstico al estado actual de WispHub hasta que sea "Terminado".
