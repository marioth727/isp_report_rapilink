import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

print("=" * 60)
print("PRUEBA: Archivo en PUT con diferentes nombres de campo")
print("=" * 60)

# 1. Obtener datos actuales del ticket
print("\n[1] Obteniendo datos actuales del ticket...")
url = f"{BASE_URL}/tickets/{TICKET_ID}/"
res = requests.get(url, headers=HEADERS)
if res.status_code != 200:
    print(f"❌ Error: {res.status_code}")
    exit()

current = res.json()
print(f"✅ Estado actual: {current.get('estado')}")
print(f"   Servicio: {current.get('servicio')}")
print(f"   Técnico: {current.get('tecnico')}")

# 2. Crear un archivo de prueba pequeño
print("\n[2] Creando archivo de prueba...")
test_file_content = b"Test image content"
test_file_name = "test_evidence.txt"

# 3. Probar diferentes nombres de campo para archivo
field_names_to_test = [
    'archivo_ticket',
    'archivo',
    'file',
    'imagen',
    'adjunto',
    'attachment'
]

for field_name in field_names_to_test:
    print(f"\n[TEST] Probando campo: '{field_name}'")
    
    # Construir FormData con todos los campos requeridos
    files = {
        field_name: (test_file_name, test_file_content, 'text/plain')
    }
    
    data = {
        'servicio': current.get('servicio'),
        'asunto': current.get('asunto'),
        'descripcion': current.get('descripcion', '.'),
        'prioridad': 2,
        'estado': current.get('estado'),  # Mantener estado actual
        'tecnico': current.get('tecnico'),
        'departamento': current.get('departamento', 'Soporte Técnico'),
        'departamentos_default': current.get('departamento', 'Soporte Técnico')
    }
    
    # NO incluir Content-Type header, dejar que requests lo maneje con boundary
    headers_multipart = {
        "Authorization": f"Api-Key {API_KEY}",
        "Accept": "application/json"
    }
    
    res = requests.put(url, headers=headers_multipart, data=data, files=files)
    print(f"   Status: {res.status_code}")
    
    if res.status_code == 200:
        print(f"   ✅ SUCCESS con campo '{field_name}'!")
        print(f"   Response: {res.json()}")
        break
    else:
        try:
            error_body = res.json()
            print(f"   ❌ Error: {error_body}")
        except:
            print(f"   ❌ Error body: {res.text[:200]}")

print("\n" + "=" * 60)
print("FIN DE PRUEBAS")
print("=" * 60)
