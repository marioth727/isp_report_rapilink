"""
PROBAR: ¿Agregar a descripcion crea burbujas de respuesta?
"""
import requests
import json
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

print("="*60)
print("TEST: Agregar mensaje a descripcion")
print("="*60)

# 1. Estado ANTES
url = f"{BASE_URL}/tickets/{TICKET_ID}/"
headers = {"Authorization": f"Api-Key {API_KEY}"}
antes = requests.get(url, headers=headers).json()

num_respuestas_antes = len(antes.get('respuestas', []))
desc_antes = antes.get('descripcion', '')

print(f"\nANTES:")
print(f"  Respuestas: {num_respuestas_antes}")
print(f"  Descripcion length: {len(desc_antes)}")

# 2. Agregar mensaje a descripcion
nuevo_mensaje = "\n\n==== PRUEBA BURBUJA VIA DESCRIPCION | 17/02/2026 12:47 ===="
nueva_descripcion = desc_antes + nuevo_mensaje

payload = {"descripcion": nueva_descripcion}

print(f"\nEnviando PATCH...")
res = requests.patch(
    url,
    headers={"Authorization": f"Api-Key {API_KEY}", "Content-Type": "application/json"},
    json=payload
)

print(f"Status: {res.status_code}")

if not res.ok:
    print(f"ERROR: {res.text}")
    exit(1)

# 3. Estado DESPUÉS
import time
time.sleep(2)  # Esperar a que WispHub procese

despues = requests.get(url, headers=headers).json()
num_respuestas_despues = len(despues.get('respuestas', []))
desc_despues = despues.get('descripcion', '')

print(f"\nDESPUES:")
print(f"  Respuestas: {num_respuestas_despues}")
print(f"  Descripcion length: {len(desc_despues)}")

# 4. Resultado
print("\n" + "="*60)
print("RESULTADO:")
print("="*60)

if num_respuestas_despues > num_respuestas_antes:
    print(f"✓ SE CREO BURBUJA! ({num_respuestas_antes} -> {num_respuestas_despues})")
    print("\nUltima respuesta creada:")
    print(json.dumps(despues['respuestas'][-1], indent=2, ensure_ascii=False))
else:
    print(f"✗ NO se creo burbuja ({num_respuestas_antes} -> {num_respuestas_despues})")
    print("  Solo se actualizo el texto de descripcion")

print("\n" + "="*60)
