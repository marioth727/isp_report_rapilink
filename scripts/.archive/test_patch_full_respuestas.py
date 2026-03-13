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

def test_full_patch():
    # 1. Get initial count
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    data = res.json()
    initial_count = len(data.get('respuestas', []))
    print(f"Inicial: {initial_count}")

    # 2. Try nested PATCH but with ALL common ticket fields (just in case)
    payload = {
        "asunto": data.get("asunto"),
        "razon_falla": data.get("razon_falla"),
        "estado": 1,
        "prioridad": 1,
        "respuestas": [
            {
                "respuesta": "Prueba Full PATCH API Agent"
            }
        ]
    }

    print(f"Testing PATCH {url} with full payload...")
    res_patch = requests.patch(url, headers=HEADERS, json=payload)
    print(f"  Status: {res_patch.status_code}")
    
    # Check
    res_after = requests.get(url, headers=HEADERS)
    new_count = len(res_after.json().get('respuestas', []))
    print(f"  Final count: {new_count}")

if __name__ == "__main__":
    test_full_patch()
