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

def test_put():
    # 1. Get current state
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code != 200:
        print("Failed to get ticket")
        return
    
    data = res.json()
    initial_count = len(data.get('respuestas', []))
    
    # 2. Modify state to include new response
    # WispHub options shows that reasoning, state, priority are also there.
    # User trace showed: respuesta, ticket-falla, ticket-estado, ticket-prioridad
    
    # We use PUT, so we send all writable fields
    payload = {
        "asunto": data.get("asunto"),
        "razon_falla": data.get("razon_falla"),
        "estado": 1, # Abierto
        "prioridad": 1, # Baja
        "servicio": data.get("servicio"),
        "tecnico": data.get("tecnico_id"),
        "respuestas": [
            {
                "respuesta": "Prueba PUT Full API Agent"
            }
        ]
    }
    
    print(f"Testing PUT {url}")
    res_put = requests.put(url, headers=HEADERS, json=payload)
    print(f"  Status: {res_put.status_code}")
    print(f"  Response: {res_put.text[:500]}")
    
    # 3. Verify
    res_after = requests.get(url, headers=HEADERS)
    new_count = len(res_after.json().get('respuestas', []))
    print(f"  Initial count: {initial_count}")
    print(f"  Final count: {new_count}")

if __name__ == "__main__":
    test_put()
