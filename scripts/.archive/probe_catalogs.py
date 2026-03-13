import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def probe_catalogs():
    catalogs = [
        "razones-falla", "estados-tickets", "prioridades-tickets",
        "respuestas-tickets", "comentarios-tickets", "ticket-comentarios",
        "ticket-respuestas", "soporte/tickets", "soporte/comentarios"
    ]
    
    for c in catalogs:
        url = f"{BASE_URL}/{c}/"
        print(f"Testing {url}")
        try:
            res = requests.get(url, headers=HEADERS, timeout=5)
            print(f"  GET Status: {res.status_code}")
            if res.status_code == 200:
                print(f"  ✅ FOUND {c}!")
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    probe_catalogs()
