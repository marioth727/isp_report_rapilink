import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

results = {"tests": []}

# Get current ticket
url = f"{BASE_URL}/tickets/{TICKET_ID}/"
res = requests.get(url, headers={"Authorization": f"Api-Key {API_KEY}", "Accept": "application/json"})
current = res.json()

# PNG minimal 1x1
png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

field_names = ['archivo_ticket', 'archivo', 'file', 'imagen', 'adjunto', 'attachment', 'evidencia']

for field_name in field_names:
    test_result = {"field_name": field_name}
    
    files = {field_name: ("test.png", png_bytes, 'image/png')}
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
    
    res = requests.put(url, headers={"Authorization": f"Api-Key {API_KEY}"}, data=data, files=files)
    test_result["status_code"] = res.status_code
    test_result["ok"] = res.ok
    
    if res.ok:
        test_result["result"] = "SUCCESS"
        results["tests"].append(test_result)
        break
    else:
        try:
            test_result["error"] = res.json()
        except:
            test_result["error"] = res.text[:200]
    
    results["tests"].append(test_result)

# Write results
with open('scripts/put_file_results.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("Results saved to scripts/put_file_results.json")
