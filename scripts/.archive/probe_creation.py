import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
TICKET_ID = 66702

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def probe_creation_endpoints():
    endpoints = [
        "respuestas", "ticket-respuestas", "tickets-respuestas",
        "respuestas-tickets", "respuesta-ticket", "tickets/respuestas",
        "tickets/respuesta"
    ]
    
    for e in endpoints:
        url = f"{BASE_URL}/{e}/"
        print(f"Testing POST {url}")
        try:
            # Según el screenshot, los campos son 'ticket' y 'respuesta'
            res = requests.post(url, headers=HEADERS, json={
                "ticket": TICKET_ID,
                "respuesta": "Probe creation test"
            })
            print(f"  Status: {res.status_code}")
            if res.status_code == 201:
                print(f"--- SUCCESS with {url} !!! ---")
                print(res.text)
                return
            elif res.status_code == 400:
                print(f"  Bad Request: {res.text[:200]}")
        except Exception as ex:
            print(f"  Error: {ex}")

if __name__ == "__main__":
    probe_creation_endpoints()
