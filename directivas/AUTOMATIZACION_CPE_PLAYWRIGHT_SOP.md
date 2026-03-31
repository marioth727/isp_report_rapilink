# SOP: Automatización de Configuraciones CPE (Playwright)
> **ID:** DIRECTIVA-CPE-AUTO-001
> **Objetivo:** Auditar y modificar automáticamente configuraciones en routers de clientes mediante automatización web headless. El objetivo actual es asignar/modificar el "Vendor ID" para suspender IPTV junto al internet.

## 1. El Patrón Maestro (Arquitectura Dinámica)

Nuestra estrategia principal no será tratar cada router de forma aislada, sino usar un **Sistema de Diccionario por Marca (Patrón Strategy)**.

### FASE A: El Mapeo (La Biblioteca de Marcas)
Antes de lanzar el robot, debemos crear un diccionario en código donde le enseñamos al sistema **dónde están los botones y campos** para cada marca. 

```javascript
// Ejemplo Conceptual del Diccionario
const CONFIG_ROUTERS = {
  "C-DATA": {
    loginURL: "http://{ip}/",
    userField: "#username",
    passField: "#password",
    submitLogin: "#login-btn",
    menuPath: ["Red", "WAN", "Configuración Avanzada"],
    vendorIdField: "input[name='vendorId']",
    saveButton: "button#apply"
  },
  "Latic": {
    // Definiremos su estructura aquí...
  },
  "Easy4link": {
    // Definiremos su estructura aquí...
  }
}
```

### FASE B: La Extracción de Datos (WispHub)
1. Conectar a la API de WispHub (`/api/clientes/`).
2. Obtener la lista de usuarios.
3. Filtrar usando 2 datos clave:
   - **`ip`** (La dirección donde accederá el robot).
   - **`marca`** o **`modelo`** (Si WispHub lo tiene registrado, o en su defecto, que el robot infiera la marca al cargar el logo inicial (`<title>`) de la IP).

### FASE C: Ejecución Automatizada (Playwright)
1. Leer IP del paso B de WispHub.
2. Ir a la IP. Detectar marca.
3. Buscar las instrucciones en el *Diccionario (Paso A)* de esa marca.
4. Introducir VendorID objetivo. Validar.
5. Continuar a la siguiente IP.

## 2. Trampas Conocidas y Reglas Zero Trust
> [!WARNING]
> Las páginas de routers viejos usan `<frameset>` y `<iframe>`. Playwright fracasará si hace `.click()` directo en la página principal en lugar de enfocarse en el marco local `frameLocator()`.

1. **Gestión Concurrente:** No podemos abrir 500 navegadores a la vez. El script debe limitar la concurrencia a `BatchSize = 5`. (Leer 5 clientes de WispHub, procesar los 5 routers, y seguir).
2. **IPs Privadas:** Asegurarse de que el script se lance desde una máquina (VPS o Servidor Local) que esté ***dentro*** de la red de administración y pueda enrutar tráfico hacia las IPs `10.x` o `192.168.x` de los CPE.
