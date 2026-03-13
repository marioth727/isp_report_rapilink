import os
import requests
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

def probe_root_collections():
    cols = [
        "respuestas", "comentarios", 
        "tickets-respuestas", "tickets-comentarios",
        "ticket-respuestas", "ticket-comentarios",
        "respuesta", "comentario"
    ]
    
    payload = {
        "ticket": TICKET_ID,
        "respuesta": "Prueba Broad Probe",
        "comentario": "Prueba Broad Probe"
    }

    for c in cols:
        url = f"{BASE_URL}/{c}/"
        print(f"Testing POST {url}")
        try:
            res = requests.post(url, headers=HEADERS, json=payload, timeout=5)
            print(f"  Status: {res.status_code}")
            if res.status_code < 400:
                print(f"--- !!! SUCCESS ON {url} !!! ---")
                return
        except Exception:
            pass

if __name__ == "__main__":
    probe_root_collections()
