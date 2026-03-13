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

def test_patch_respuestas():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    print(f"Testing PATCH {url} with nested 'respuestas' array")
    
    # 1. Get current ticket to avoid overwriting or if we need to send the full array
    r_get = requests.get(url, headers=HEADERS)
    if r_get.status_code != 200:
        print("Error getting ticket")
        return
    
    ticket_data = r_get.json()
    current_respuestas = ticket_data.get('respuestas', [])
    
    # 2. Add new response
    new_resp = {
        "respuesta": "[CRM TEST] Respuesta añadida vía PATCH al array de respuestas."
    }
    
    payload = {
        "respuestas": current_respuestas + [new_resp]
    }
    
    try:
        res = requests.patch(url, headers=HEADERS, json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:500]}")
        
        if res.status_code == 200:
            print("✅ El PATCH parece haber funcionado. Verificando...")
            r_verify = requests.get(url, headers=HEADERS)
            verify_data = r_verify.json()
            print(f"Número de respuestas ahora: {len(verify_data.get('respuestas', []))}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_patch_respuestas()
