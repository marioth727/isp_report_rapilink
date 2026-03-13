import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def get_response_count():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return len(res.json().get('respuestas', []))
    return -1

def test_multipart_plain():
    initial_count = get_response_count()
    print(f"Número inicial de respuestas: {initial_count}")

    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    
    # IMPORTANTE: Usar multipart/form-data y TEXTO PLANO
    files = {
        'respuesta': (None, 'Prueba Final: Texto Plano via Multipart API Agent'),
        'ticket-falla': (None, 'No Responde El Router Wifi'),
        'ticket-estado': (None, '1'),
        'ticket-prioridad': (None, '1')
    }

    print(f"Probando PATCH a {url} con MULTIPART y TEXTO PLANO...")
    res = requests.patch(url, headers=HEADERS, files=files)
    
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:500]}")

    if res.status_code < 300:
        new_count = get_response_count()
        print(f"Número final de respuestas: {new_count}")
        if new_count > initial_count:
            print("✅ ¡GANAMOS! Se creó la respuesta correctamente.")
        else:
            print("❌ El PATCH fue aceptado pero NO se creó una respuesta.")
    else:
        print("❌ El PATCH falló.")

if __name__ == "__main__":
    test_multipart_plain()
