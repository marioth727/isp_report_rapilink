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

print("="*60)
print("TEST: File upload via PUT with different field names")
print("="*60)

# 1. Get current ticket data
print("\n[1] Getting current ticket data...")
url = f"{BASE_URL}/tickets/{TICKET_ID}/"
res = requests.get(url, headers=HEADERS)
if res.status_code != 200:
    print(f"ERROR: {res.status_code}")
    print(res.text)
    exit()

current = res.json()
print(f"Current state: {current.get('estado')}")
print(f"Service: {current.get('servicio')}")
print(f"Technician: {current.get('tecnico')}")

# 2. Create test file
print("\n[2] Creating test PNG file...")
# Minimal PNG (1x1 pixel transparent)
png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
test_file_name = "test_evidence.png"

# 3. Test different field names
field_names = [
    'archivo_ticket',
    'archivo',
    'file',
    'imagen',
    'adjunto',
    'attachment',
    'evidencia'
]

for field_name in field_names:
    print(f"\n[TEST] Field: '{field_name}'")
    
    files = {
        field_name: (test_file_name, png_bytes, 'image/png')
    }
    
    data = {
        'servicio': current.get('servicio'),
        'asunto': current.get('asunto', 'Instalacion Nueva'),
        'descripcion': current.get('descripcion', '.'),
        'prioridad': 2,
        'estado': current.get('estado'),
        'tecnico': current.get('tecnico'),
        'departamento': 'Soporte Tecnico',
        'departamentos_default': 'Soporte Tecnico'
    }
    
    headers_multipart = {
        "Authorization": f"Api-Key {API_KEY}",
        "Accept": "application/json"
    }
    
    res = requests.put(url, headers=headers_multipart, data=data, files=files)
    print(f"   Status: {res.status_code}")
    
    if res.status_code == 200:
        print(f"   SUCCESS with '{field_name}'!")
        break
    else:
        try:
            error_body = res.json()
            print(f"   Error: {error_body}")
        except:
            print(f"   Error text: {res.text[:100]}")

print("\n" + "="*60)
print("END OF TESTS")
print("="*60)
