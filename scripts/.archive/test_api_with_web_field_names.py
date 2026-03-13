import os
import requests
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

def run_test():
    initial_count = get_response_count()
    print(f"Número inicial de respuestas: {initial_count}")

    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    
    # Probaremos con los nombres EXACTOS del formulario web
    payload = {
        'respuesta': 'Prueba Nombres Web via API Agent',
        'ticket-falla': 'No Responde El Router Wifi',
        'ticket-estado': '1',
        'ticket-prioridad': '1'
    }

    print(f"Probando PATCH a {url} con nombres web...")
    # Use multipart/form-data as it's more resilient for WispHub
    files = {k: (None, str(v)) for k, v in payload.items()}
    res = requests.patch(url, headers=HEADERS, files=files)
    
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:500]}")

    new_count = get_response_count()
    print(f"Número final de respuestas: {new_count}")
    if new_count > initial_count:
        print("✅ ¡GANAMOS!")
    else:
        print("❌ No se creó respuesta.")

if __name__ == "__main__":
    run_test()
