"""
SCRIPT PARA MOSTRAR A INGENIEROS DE WISPHUB
Muestra cómo se envía el cierre de ticket con archivo adjunto
"""
import requests

# ====== CONFIGURACIÓN ======
API_KEY = "TU_API_KEY_AQUI"
TICKET_ID = "66702"
BASE_URL = "https://api.wisphub.io/api"
url = f"{BASE_URL}/tickets/{TICKET_ID}/"

# ====== PASO 1: Obtener ticket actual ======
headers = {"Authorization": f"Api-Key {API_KEY}"}
ticket = requests.get(url, headers=headers).json()

# ====== PASO 2: Preparar archivo (PNG de 10KB) ======
png_bytes = b'\x89PNG\r\n...(10KB de datos)...\xaeB`\x82'

# ====== PASO 3: Construir payload ======
payload_data = {
    'servicio': ticket.get('servicio'),
    'asunto': ticket.get('asunto'),
    'descripcion': ticket.get('descripcion'),
    'prioridad': 2,
    'estado': 3,  # Cerrado
    'tecnico': 1428053,  # ID del técnico
    'departamento': 'Soporte Tecnico',
    'departamentos_default': 'Soporte Tecnico',
    'fecha_final': '2026-02-17 12:30:00'
}

# ====== PASO 4: Enviar PUT con multipart/form-data ======
files = {
    'archivo_ticket': ('evidencia.png', png_bytes, 'image/png')
}

response = requests.put(
    url,
    headers=headers,
    data=payload_data,  # Campos del formulario
    files=files         # Archivo binario
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# ====== ERRORES COMUNES ======
# 400 + "archivo_ticket: extensiones permitidas..." 
#   → Otros campos inválidos (tecnico, estado, etc.)
# 
# 400 + "tecnico: opción no válida"
#   → ID de técnico inexistente o inactivo
#
# 400 + "estado: opción no válida"  
#   → Debe ser número (1, 2, 3), no string
