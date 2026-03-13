"""
CÓDIGO PARA MOSTRAR A INGENIEROS DE WISPHUB
Intento de crear respuesta/burbuja usando PUT con campo 'descripcion'
"""
import requests
import json
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"
url = f"{BASE_URL}/tickets/{TICKET_ID}/"

print("="*70)
print("CÓDIGO PUT PARA CREAR RESPUESTA EN TICKET")
print("="*70)

# ====== PASO 1: Obtener ticket actual ======
print("\n[1] GET - Obtener datos actuales del ticket")
headers = {"Authorization": f"Api-Key {API_KEY}"}
response_get = requests.get(url, headers=headers)
ticket = response_get.json()

print(f"  URL: {url}")
print(f"  Status: {response_get.status_code}")
print(f"  Respuestas actuales: {len(ticket.get('respuestas', []))}")
print(f"  Descripcion length: {len(ticket.get('descripcion', ''))}")

# ====== PASO 2: Preparar nuevo mensaje para descripcion ======
mensaje_nuevo = "\n\n==== TICKET INICIADO | JAIME MARTINEZ | 17/02/2026 12:50 ===="
descripcion_actualizada = (ticket.get('descripcion', '') + mensaje_nuevo).strip()

# ====== PASO 3: Construir payload completo para PUT ======
print("\n[2] Construyendo payload para PUT")

# Resolver tecnico_id
tecnico_raw = ticket.get('tecnico')
if isinstance(tecnico_raw, dict):
    tecnico_id = tecnico_raw.get('id')
else:
    tecnico_id = int(tecnico_raw) if str(tecnico_raw).isdigit() else 1428053

payload = {
    'servicio': ticket.get('servicio'),
    'asunto': ticket.get('asunto', 'Instalacion Nueva'),
    'descripcion': descripcion_actualizada,  # ← Descripción con mensaje nuevo
    'prioridad': ticket.get('prioridad', 2),
    'estado': ticket.get('estado', 1),
    'tecnico': tecnico_id,
    'departamento': ticket.get('departamento', 'Soporte Tecnico'),
    'departamentos_default': ticket.get('departamento', 'Soporte Tecnico')
}

print("  Payload construido:")
for key, val in payload.items():
    if key != 'descripcion':
        print(f"    {key}: {val}")
print(f"    descripcion: ...{descripcion_actualizada[-50:]}")

# ====== PASO 4: Enviar PUT ======
print("\n[3] PUT - Enviar actualización")
print(f"  URL: {url}")
print(f"  Method: PUT")
print(f"  Content-Type: application/json")

headers_put = {
    "Authorization": f"Api-Key {API_KEY}",
    "Content-Type": "application/json"
}

response_put = requests.put(url, headers=headers_put, json=payload)

print(f"  Status: {response_put.status_code}")

# ====== PASO 5: Verificar resultado ======
print("\n[4] GET - Verificar cambios")
import time
time.sleep(1)

response_check = requests.get(url, headers=headers)
ticket_actualizado = response_check.json()

respuestas_despues = len(ticket_actualizado.get('respuestas', []))
descripcion_despues_length = len(ticket_actualizado.get('descripcion', ''))

print(f"  Respuestas después: {respuestas_despues}")
print(f"  Descripcion length después: {descripcion_despues_length}")

# ====== RESULTADO ======
print("\n" + "="*70)
print("RESULTADO")
print("="*70)

if response_put.ok:
    print("✓ PUT exitoso (status 200)")
    print(f"  Descripción actualizada: {descripcion_despues_length} chars")
    
    if respuestas_despues > len(ticket.get('respuestas', [])):
        print(f"  ✓ SE CREÓ BURBUJA DE RESPUESTA!")
        print("\n  Ultima respuesta:")
        print(json.dumps(ticket_actualizado['respuestas'][-1], indent=4, ensure_ascii=False))
    else:
        print(f"  ✗ NO se creó burbuja de respuesta")
        print(f"     Solo se actualizó el texto de 'descripcion'")
else:
    print(f"✗ PUT falló (status {response_put.status_code})")
    print(f"  Error: {response_put.text[:200]}")

print("\n" + "="*70)
print("ESTRUCTURA DEL REQUEST ENVIADO")
print("="*70)
print(f"""
PUT {url}

Headers:
  Authorization: Api-Key {API_KEY[:20]}...
  Content-Type: application/json

Body (JSON):
{json.dumps(payload, indent=2, ensure_ascii=False, default=str)[:500]}...

""")
print("="*70)
