"""
BRUTE FORCE: Buscar el endpoint correcto para respuestas/comentarios
Probaremos variaciones de URL para ver cuál no da 404.
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
    "Accept": "application/json"
}

# Variaciones de URL
patterns = [
    "/tickets/{id}/respuestas/",
    "/tickets/{id}/comentarios/",
    "/tickets/respuestas/",
    "/tickets/comentarios/",
    "/v1/tickets/{id}/respuestas/",
    "/v1/tickets/{id}/comentarios/",
    "/v1/respuestas/",
    "/v1/comentarios/",
    "/respuestas-tickets/",
    "/comentarios-tickets/",
    "/tickets/{id}/log/",
    "/tickets/{id}/historial/"
]

print("="*60)
print("BUSCANDO ENDPOINT DE RESPUESTAS")
print("="*60)

for p in patterns:
    url_path = p.replace("{id}", TICKET_ID)
    url = f"{BASE_URL}{url_path}"
    
    # Probamos con OPTIONS primero para ver si existe el endpoint
    try:
        res = requests.options(url, headers=headers)
        status = res.status_code
        print(f"[{status}] {url}")
        
        if status != 404:
            print(f"  ⭐ ¡POSIBLE ENDPOINT ENCONTRADO! Metodos: {res.headers.get('Allow')}")
            # Si permite POST, intentamos un GET para ver el formato
            res_get = requests.get(url, headers=headers)
            print(f"  GET Status: {res_get.status_code}")
            if res_get.status_code == 200:
                print(f"  Data: {str(res_get.json())[:200]}...")
    except Exception as e:
        print(f"[ERR] {url}: {e}")

print("\n" + "="*60)
