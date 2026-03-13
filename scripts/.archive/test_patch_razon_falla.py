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

def test_patch_razon_falla():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    print(f"Testing PATCH {url} with razon_falla")
    
    # Intentamos enviar 'razon_falla'
    payload = {
        "razon_falla": "PRUEBA AUTOMATICA CRM",
        "descripcion": "Actualizando descripción para ver si razon_falla genera respuesta."
    }
    
    try:
        res = requests.patch(url, headers=HEADERS, json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:1000]}")
        
        if res.status_code == 200:
            print("✅ El PATCH fue aceptado. Verificando respuestas...")
            r_get = requests.get(url, headers=HEADERS)
            data = r_get.json()
            respuestas = data.get('respuestas', [])
            print(f"Número de respuestas ahora: {len(respuestas)}")
            for r in respuestas:
                print(f" - {r.get('respuesta')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_patch_razon_falla()
