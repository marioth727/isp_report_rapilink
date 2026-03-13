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

def test_patch_ticket():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    print(f"Testing PATCH {url}")
    
    # Intentamos enviar 'respuesta' como campo adicional en el PATCH del ticket
    # Esta es la hipótesis del usuario: la lógica es editar el ticket
    payload = {
        "respuesta": "[SISTEMA]: Prueba de patch directo al ticket."
    }
    
    try:
        res = requests.patch(url, headers=HEADERS, json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:1000]}")
        
        if res.status_code < 400:
            print("✅ El PATCH fue aceptado. Verificando si la respuesta se agregó...")
            # Consultamos el ticket de nuevo
            r_get = requests.get(url, headers=HEADERS)
            ticket_data = r_get.json()
            respuestas = ticket_data.get('respuestas', [])
            print(f"Número de respuestas ahora: {len(respuestas)}")
            for r in respuestas:
                print(f" - {r.get('respuesta')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_patch_ticket()
