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

def find_tick_with_resp():
    url = f"{BASE_URL}/tickets/?limit=50&ordering=-id"
    res = requests.get(url, headers=HEADERS)
    tickets = res.json().get('results', [])
    
    for t in tickets:
        tid = t.get('id_ticket')
        # Get detail to see 'respuestas'
        detail_url = f"{BASE_URL}/tickets/{tid}/"
        d_res = requests.get(detail_url, headers=HEADERS)
        data = d_res.json()
        respuestas = data.get('respuestas', [])
        if len(respuestas) > 0:
            print(f"✅ FOUND! Ticket {tid} has {len(respuestas)} responses.")
            print(json.dumps(respuestas[0], indent=2))
            return
        else:
            print(f"Ticket {tid}: 0 responses.")

if __name__ == "__main__":
    import json
    find_tick_with_resp()
