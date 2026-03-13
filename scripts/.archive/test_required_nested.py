import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def get_response_count():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return len(res.json().get('respuestas', []))
    return -1

def test_required_nested():
    initial_count = get_response_count()
    print(f"Número inicial de respuestas: {initial_count}")

    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    
    # Intentamos enviar todos los campos que figuran como "required" en OPTIONS
    # JAIME MARTINEZ ID: 1425148
    payload = {
        "respuestas": [
            {
                "respuesta": "Prueba API: Respuesta con campos requeridos",
                "created": datetime.now().strftime("%m/%d/%Y %H:%M:%S"),
                "autor": {
                    "id": 1425148
                }
            }
        ]
    }

    print(f"Probando PATCH a {url} con JSON completo...")
    res = requests.patch(url, headers=HEADERS, json=payload)
    
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:500]}")

    if res.status_code < 300:
        new_count = get_response_count()
        print(f"Número final de respuestas: {new_count}")
        if new_count > initial_count:
            print("✅ ¡GANAMOS! La estructura anidada completa funcionó.")
        else:
            print("❌ El PATCH fue aceptado pero NO se creó una respuesta.")
    else:
        print("❌ El PATCH falló.")

if __name__ == "__main__":
    test_required_nested()
