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

def get_ticket_data():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return res.json()
    return None

def test_nested_patch():
    ticket = get_ticket_data()
    if not ticket:
        print("Error fetching ticket.")
        return

    initial_count = len(ticket.get('respuestas', []))
    print(f"Número inicial de respuestas: {initial_count}")

    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    
    # Estructura anidada sugerida por el usuario
    payload = {
        "respuestas": [
            {
                "respuesta": "Prueba Anidada: Respuestas -> Respuesta (API Agent)"
            }
        ]
    }

    print(f"Probando PATCH a {url} con JSON anidado...")
    res = requests.patch(url, headers=HEADERS, json=payload)
    
    print(f"Status: {res.status_code}")
    # print(f"Response: {res.text[:500]}")

    if res.status_code < 300:
        new_ticket = get_ticket_data()
        new_count = len(new_ticket.get('respuestas', []))
        print(f"Número final de respuestas: {new_count}")
        if new_count > initial_count:
            print("✅ ¡ÉXITO! La estructura anidada funcionó.")
        else:
            print("❌ El PATCH fue aceptado pero NO se creó una respuesta (posiblemente campo read-only ignorado).")
    else:
        print(f"❌ El PATCH falló: {res.status_code} - {res.text}")

if __name__ == "__main__":
    test_nested_patch()
