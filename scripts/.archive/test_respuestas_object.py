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
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def get_response_count():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return len(res.json().get('respuestas', []))
    return -1

if __name__ == "__main__":
    initial = get_response_count()
    print(f"Inicial: {initial}")

    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    
    # Probando respuestas como OBJETO (no array)
    payload = {
        "respuestas": {
            "respuesta": "Prueba Objeto Singular API Agent"
        }
    }

    print(f"Probando PATCH a {url} con OBJETO singular...")
    res = requests.patch(url, headers=HEADERS, json=payload)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:200]}")

    final = get_response_count()
    print(f"Final: {final}")
