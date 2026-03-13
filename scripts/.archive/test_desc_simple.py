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

print(f"Descripcion actual length: {len(current.get('descripcion', ''))}")
print(f"Respuestas actuales: {len(current.get('respuestas', []))}")

# 2. Agregar nueva línea a descripcion
nueva_linea = "\n\n==== PRUEBA RESPUESTA VIA DESCRIPCION | 17/02/2026 12:22 | AGENTE ===="
nueva_descripcion = (current.get('descripcion', '') + nueva_linea).strip()

# 3. Payload simple
payload = {
    'descripcion': nueva_descripcion
}

print("\n[2] Enviando PATCH con campo descripcion...")

res = requests.patch(
    url,
    headers={
        "Authorization": f"Api-Key {API_KEY}",
        "Content-Type": "application/json"
    },
    json=payload
)

print(f"Status: {res.status_code}")

if res.ok:
    print("SUCCESS!")
    # Verificar cambios
    check = requests.get(url, headers={"Authorization": f"Api-Key {API_KEY}"}).json()
    print(f"Descripcion nueva length: {len(check.get('descripcion', ''))}")
    print(f"Respuestas nuevas: {len(check.get('respuestas', []))}")
    
    # Ver ultimas respuestas
    if check.get('respuestas'):
        print("\nUltima respuesta:")
        print(json.dumps(check['respuestas'][-1], indent=2, ensure_ascii=False))
else:
    print(f"ERROR: {res.text}")

# Guardar
with open('scripts/desc_test_result.json', 'w', encoding='utf-8') as f:
    json.dump({"status": res.status_code, "ok": res.ok, "text": res.text[:500]}, f, indent=2)
