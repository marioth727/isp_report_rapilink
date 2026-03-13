"""
TEST FINAL: Usar el dominio .NET para crear burbujas
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL_NET = "https://api.wisphub.net/api"

headers = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

url = f"{BASE_URL_NET}/tickets/{TICKET_ID}/respuestas/"

payload = {
    "ticket": TICKET_ID,
    "respuesta": "¡ÉXITO! Burbuja creada usando dominio .NET",
    "comentario": "¡ÉXITO! Burbuja creada usando dominio .NET"
}

print("="*60)
print(f"PROBANDO DOMINIO .NET: {url}")
print("="*60)

try:
    res = requests.post(url, headers=headers, json=payload)
    print(f"Status: {res.status_code}")
    if res.ok:
        print("✅ ¡BURBUJA CREADA EXITOSAMENTE!")
        print(f"Response: {res.text[:200]}")
    else:
        print(f"❌ Falló con status {res.status_code}")
        print(f"Error: {res.text[:200]}")
except Exception as e:
    print(f"❌ Error de conexión: {e}")

print("\n" + "="*60)
