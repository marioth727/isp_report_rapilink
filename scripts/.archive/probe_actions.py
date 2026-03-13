import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
TICKET_ID = 66666

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def probe_actions():
    actions = [
        "reportar_llegada", "reportar-llegada", "llegada", "en_sitio", "en-sitio", 
        "iniciar", "start", "arrive", "arrival", "report_arrival", 
        "respuestas", "respuesta", "comentarios", "comentario", "notas", "nota"
    ]
    
    results = []
    
    for action in actions:
        # Test as sub-resource
        url = f"{BASE_URL}/tickets/{TICKET_ID}/{action}/"
        print(f"Testing POST {url}")
        try:
            res = requests.post(url, headers=HEADERS, json={})
            print(f"  Status: {res.status_code}")
            results.append({"url": url, "status": res.status_code, "text": res.text[:100]})
        except Exception as e:
            print(f"  Error: {e}")

    with open('action_probe_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    probe_actions()
