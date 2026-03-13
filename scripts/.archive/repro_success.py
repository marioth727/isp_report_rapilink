"""
REPRODUCIR ÉXITO DE AYER
Intentaremos los 4 endpoints que usa wisphub.ts
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

headers = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

endpoints = [
    f"{BASE_URL}/tickets/{TICKET_ID}/comentarios/",
    f"{BASE_URL}/tickets/comentarios/",
    f"{BASE_URL}/tickets/{TICKET_ID}/respuestas/",
    f"{BASE_URL}/tickets/respuestas/"
]

payload = {
    "ticket": TICKET_ID,
    "comentario": "Prueba de burbuja - REPRODUCCION",
    "respuesta": "Prueba de burbuja - REPRODUCCION"
}

print("="*60)
print("REINTENTANDO ENDPOINTS DE WISPHUB.TS")
print("="*60)

for url in endpoints:
    print(f"\n[INTENTO] POST a: {url}")
    try:
        # Intentamos POST con JSON
        res = requests.post(url, headers=headers, json=payload)
        print(f"  Status: {res.status_code}")
        if res.ok:
            print("  ✅ ¡EXITO!")
            print(f"  Response: {res.text[:200]}")
        else:
            print(f"  ❌ Fallo: {res.text[:200]}")
            
    except Exception as e:
        print(f"  ❌ Excepcion: {e}")

print("\n" + "="*60)
