import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

# 1. Get current ticket
print("[1] Obteniendo ticket actual...")
url = f"{BASE_URL}/tickets/{TICKET_ID}/"
res = requests.get(url, headers={"Authorization": f"Api-Key {API_KEY}"})
current = res.json()

print(f"Descripcion actual: {current.get('descripcion', '')[:100]}...")
print(f"Respuestas actuales: {len(current.get('respuestas', []))} burbujas")

# 2. Obtener ID de técnico válido
tecnico_id = None
tecnico_raw = current.get('tecnico')
if isinstance(tecnico_raw, dict):
    tecnico_id = tecnico_raw.get('id')
elif isinstance(tecnico_raw, (int, str)):
    tecnico_id = int(tecnico_raw) if str(tecnico_raw).isdigit() else None

if not tecnico_id:
    # Fallback: obtener lista de técnicos
    staff_res = requests.get(f"{BASE_URL}/tecnicos/", headers={"Authorization": f"Api-Key {API_KEY}"})
    staff = staff_res.json().get('results', [])
    if staff:
        tecnico_id = staff[0].get('id')

print(f"Usando tecnico_id: {tecnico_id}")

# 3. Agregar nueva línea a descripcion
nueva_linea = "\n\n==== PRUEBA DE RESPUESTA | 17/02/2026 12:22 ===="
nueva_descripcion = (current.get('descripcion', '') + nueva_linea).strip()

# 4. Hacer PUT con nueva descripcion
payload = {
    'servicio': current.get('servicio'),
    'asunto': current.get('asunto', 'Instalacion Nueva'),
    'descripcion': nueva_descripcion,
    'prioridad': current.get('prioridad', 2),
    'estado': current.get('estado', 1),
    'tecnico': tecnico_id,
    'departamento': current.get('departamento', 'Soporte Tecnico'),
    'departamentos_default': current.get('departamento', 'Soporte Tecnico')
}

print("\n[2] Enviando PUT con descripcion actualizada...")
print(f"Nueva descripcion (ultimos 100 chars): ...{nueva_descripcion[-100:]}")

# Usar FormData
from requests_toolbelt import MultipartEncoder
fields = {k: str(v) for k, v in payload.items()}
multipart_data = MultipartEncoder(fields=fields)

res = requests.put(
    url,
    headers={
        "Authorization": f"Api-Key {API_KEY}",
        "Content-Type": multipart_data.content_type
    },
    data=multipart_data
)

print(f"Status: {res.status_code}")

if res.status_code == 200:
    print("SUCCESS!")
    # Verificar si se creo burbuja
    check_res = requests.get(url, headers={"Authorization": f"Api-Key {API_KEY}"})
    updated = check_res.json()
    print(f"Respuestas despues: {len(updated.get('respuestas', []))} burbujas")
    print(f"Descripcion despues: ...{updated.get('descripcion', '')[-100:]}")
else:
    print(f"ERROR: {res.text[:200]}")

# Guardar resultado
result = {
    "status": res.status_code,
    "ok": res.ok,
    "response": res.text[:300] if not res.ok else "SUCCESS"
}

with open('scripts/test_descripcion_result.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2)

print("\nResultado guardado en scripts/test_descripcion_result.json")
