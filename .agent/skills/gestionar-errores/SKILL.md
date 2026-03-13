---
name: gestionar-errores
description: Implementa patrones robustos de manejo de errores en múltiples lenguajes (Python, JS/TS, Rust, Go). Úsese cuando el usuario solicite mejorar la resiliencia de la aplicación, depurar fallos en producción o diseñar APIs tolerantes a fallos.
---

# Patrones de Manejo de Errores

Construye aplicaciones resilientes con estrategias robustas de manejo de errores que gestionen los fallos con elegancia y proporcionen excelentes experiencias de depuración.

## Cuándo Usar Esta Skill
- Implementar manejo de errores en nuevas funcionalidades.
- Diseñar APIs resilientes a errores o reintentos con backoff.
- Depurar problemas en producción mediante logs contextualizados.
- Mejorar la fiabilidad de la aplicación usando patrones como Circuit Breaker.

## Flujo de Trabajo
1. **Identificar la Naturaleza del Error**: ¿Es recuperable (red) o irrecuperable (bug de lógica)?
2. **Elegir la Estrategia**: `try-catch` para excepciones o Tipos `Result` para flujos controlados.
3. **Preservar Contexto**: Asegurarse de incluir IDs, timestamps y stack traces.
4. **Implementar Limpieza**: Usar bloques `finally` o context managers para liberar recursos.

## Instrucciones Principales

### 1. Filosofías de Manejo de Errores
- **Excepciones**: Úsalas para condiciones excepcionales e inesperadas.
- **Tipos Result**: Úsalos para errores esperados y lógica de negocio (validaciones).
- **Fail Fast**: Valida las entradas al principio para evitar fallos en mitad de la ejecución.

### 2. Patrones por Lenguaje

#### TypeScript / JavaScript
```typescript
// Clases de error personalizadas
class ApplicationError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 500,
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Patrón Result Type
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

#### Python
```python
class ApplicationError(Exception):
    """Excepción base para todos los errores de la aplicación."""
    def __init__(self, message: str, code: str = None, details: dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        self.timestamp = datetime.utcnow()

# Reintento con Backoff Exponencial
def retry(max_attempts=3, backoff_factor=2.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try: return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1: raise
                    time.sleep(backoff_factor ** attempt)
        return wrapper
    return decorator
```

### 3. Patrones Universales
- **Circuit Breaker**: Evita fallos en cascada abriendo el circuito tras N fallos consecutivos.
- **Graceful Degradation**: Provee funcionalidad de respaldo (fallback) cuando el recurso principal no está disponible.

## Mejores Prácticas
- **Mensajes Significativos**: Explica qué pasó y, si es posible, cómo arreglarlo.
- **No Tragar Errores**: Nunca uses un catch vacío sin loguear o relanzar.
- **Logueo Apropiado**: Loguea errores reales; no llenes los logs con fallos de validación esperados.

## Recursos
- [Diseño de Jerarquías](references/exception-hierarchy-design.md)
- [Estrategias de Recuperación](references/error-recovery-strategies.md)
- [Guía de Mensajes de Error](assets/error-message-guide.md)
