"""
Script de demostración para mostrar a los ingenieros de WispHub
cómo la aplicación ISP Reports está enviando peticiones de cierre de ticket con archivo.

Este script replica exactamente la lógica del frontend TypeScript.
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'  # Ticket de prueba
BASE_URL = "https://api.wisphub.io/api"

print("="*70)
print("DEMOSTRACIÓN: Cierre de Ticket con Archivo Adjunto")
print("="*70)

# ============================================================================
# PASO 1: Obtener datos actuales del ticket
# ============================================================================
print("\n[PASO 1] Obteniendo datos actuales del ticket...")
url = f"{BASE_URL}/tickets/{TICKET_ID}/"
headers = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

response = requests.get(url, headers=headers)
if response.status_code != 200:
    print(f"ERROR al obtener ticket: {response.status_code}")
    print(response.text)
    exit(1)

current_ticket = response.json()
print(f"✓ Ticket obtenido")
print(f"  - Servicio: {current_ticket.get('servicio')}")
print(f"  - Asunto: {current_ticket.get('asunto')}")
print(f"  - Estado actual: {current_ticket.get('estado')}")
print(f"  - Técnico: {current_ticket.get('tecnico')}")

# ============================================================================
# PASO 2: Preparar el archivo de evidencia
# ============================================================================
print("\n[PASO 2] Preparando archivo de evidencia...")

# Crear un PNG válido de 10KB (simulando foto de campo)
# Header PNG + datos simulados
png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00d\x00\x00\x00d\x08\x02\x00\x00\x00\xff\x80\x02\x03'
png_data = png_header + (b'\x00' * 10000) + b'IEND\xaeB`\x82'

file_name = "evidencia_cierre.png"
file_size = len(png_data)

print(f"✓ Archivo creado: {file_name} ({file_size} bytes)")

# ============================================================================
# PASO 3: Construir el payload para PUT
# ============================================================================
print("\n[PASO 3] Construyendo payload...")

# Resolver ID numérico del técnico (WispHub requiere ID, no objeto)
tecnico_id = None
tecnico_raw = current_ticket.get('tecnico')

if isinstance(tecnico_raw, dict):
    tecnico_id = tecnico_raw.get('id')
elif isinstance(tecnico_raw, (int, str)):
    tecnico_id = int(tecnico_raw) if str(tecnico_raw).isdigit() else None

if not tecnico_id:
    print("  ! No se pudo resolver tecnico_id del ticket actual")
    print("  ! Esto causará error 400: 'tecnico: opción no válida'")
    # Para demo, usar un ID de respaldo (debes ajustar según tu BD)
    tecnico_id = 1428053  # ID de ejemplo

print(f"  - Técnico ID: {tecnico_id}")

# Payload completo requerido por WispHub
payload_data = {
    'servicio': current_ticket.get('servicio'),
    'asunto': current_ticket.get('asunto', 'Instalacion Nueva'),
    'descripcion': current_ticket.get('descripcion', '.'),
    'prioridad': current_ticket.get('prioridad', 2),
    'estado': 3,  # 3 = Resuelto/Cerrado
    'tecnico': tecnico_id,
    'departamento': current_ticket.get('departamento', 'Soporte Tecnico'),
    'departamentos_default': current_ticket.get('departamento', 'Soporte Tecnico'),
    'fecha_final': '2026-02-17 12:30:00'  # Formato: YYYY-MM-DD HH:MM:SS
}

print("✓ Payload construido:")
for key, value in payload_data.items():
    if key != 'descripcion':  # Evitar imprimir descripción completa
        print(f"  - {key}: {value}")

# ============================================================================
# PASO 4: Enviar PUT con FormData (multipart/form-data)
# ============================================================================
print("\n[PASO 4] Enviando PUT con archivo adjunto...")
print(f"  URL: {url}")
print(f"  Método: PUT")
print(f"  Content-Type: multipart/form-data (automático)")

# Preparar FormData con archivo
files = {
    'archivo_ticket': (file_name, png_data, 'image/png')
}

# Headers sin Content-Type (requests lo manejará automáticamente con boundary)
headers_multipart = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
    # NO incluir Content-Type, requests lo agregará con boundary correcto
}

# Enviar petición
response = requests.put(
    url,
    headers=headers_multipart,
    data=payload_data,  # Campos del formulario
    files=files         # Archivo binario
)

# ============================================================================
# PASO 5: Mostrar resultado
# ============================================================================
print("\n" + "="*70)
print("RESULTADO")
print("="*70)
print(f"Status Code: {response.status_code}")
print(f"OK: {response.ok}")

if response.ok:
    print("\n✓ SUCCESS - Ticket cerrado correctamente")
    print("  El archivo se adjuntó exitosamente")
else:
    print("\n✗ ERROR - La petición falló")
    print(f"\nRespuesta del servidor:")
    try:
        error_json = response.json()
        import json
        print(json.dumps(error_json, indent=2, ensure_ascii=False))
    except:
        print(response.text)

print("\n" + "="*70)
print("NOTAS PARA INGENIEROS DE WISPHUB:")
print("="*70)
print("1. Campo 'archivo_ticket' se envía como File en multipart/form-data")
print("2. Todos los demás campos van como strings en el FormData")
print("3. El archivo es PNG válido de 10KB")
print("4. Content-Type se omite en headers (requests lo genera automáticamente)")
print("5. Si hay error 400 con 'tecnico' o 'estado', revisar IDs válidos")
print("="*70)
