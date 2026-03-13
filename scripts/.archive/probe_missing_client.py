import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
TICKET_ID = 66666
SERVICE_ID = 4080

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def probe_missing_client():
    variations = [
        {"ticket": TICKET_ID, "id_cliente": SERVICE_ID, "comentario": "Test id_cliente=service_id"},
        {"ticket": TICKET_ID, "cliente": SERVICE_ID, "comentario": "Test cliente=service_id"},
        {"id_ticket": TICKET_ID, "id_cliente": SERVICE_ID, "comentario": "Test id_ticket+id_cliente"},
        {"ticket": TICKET_ID, "id_servicio": SERVICE_ID, "comentario": "Test id_servicio"},
        {"ticket": TICKET_ID, "id_cliente": TICKET_ID, "comentario": "Test id_cliente=ticket_id"},
    ]
    
    url = f"{BASE_URL}/tickets/comentarios/"
    print(f"Probing POST {url}")
    
    for payload in variations:
        print(f"\nTesting Payload: {payload}")
        try:
            res = requests.post(url, headers=HEADERS, json=payload)
            print(f"Status: {res.status_code}")
            print(f"Response: {res.text}")
            if res.status_code == 201 or res.status_code == 200:
                print("--- SUCCESS! ---")
                return
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    probe_missing_client()
