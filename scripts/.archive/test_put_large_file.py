import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

# Get current ticket
url = f"{BASE_URL}/tickets/{TICKET_ID}/"
res = requests.get(url, headers={"Authorization": f"Api-Key {API_KEY}"})
current = res.json()

# Create a larger PNG (100x100 red square - approx 300 bytes)
png_header = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00d\x00\x00\x00d\x08\x02\x00\x00\x00\xff\x80\x02\x03'
# Add image data (simplified - just making it 5KB)
png_data = png_header + (b'\x00' * 5000) + b'IEND\xaeB`\x82'

# Test with archivo_ticket  
files = {'archivo_ticket': ("evidence_large.png", png_data, 'image/png')}

data = {
    'servicio': current.get('servicio'),
    'asunto': current.get('asunto', 'Instalacion Nueva'),
    'descripcion': current.get('descripcion', 'Test'),
    'prioridad': 2,
    'estado': current.get('estado'),
    'tecnico': current.get('tecnico'),
    'departamento': 'Soporte Tecnico',
    'departamentos_default': 'Soporte Tecnico'
}

print("Testing PUT with archivo_ticket and 5KB file...")
res = requests.put(url, headers={"Authorization": f"Api-Key {API_KEY}"}, data=data, files=files)
print(f"Status: {res.status_code}")

result = {
    "status": res.status_code,
    "ok": res.ok,
    "content": res.text[:500] if not res.ok else "SUCCESS"
}

with open('scripts/put_large_file_result.json', 'w') as f:
    json.dump(result, f, indent=2)

print("Result saved to scripts/put_large_file_result.json")

if res.ok:
    print("SUCCESS! archivo_ticket works with PUT!")
else:
    print(f"Failed: {res.text[:200]}")
