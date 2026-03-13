import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
# Use a fresh test ticket if possible or 66702
TICKET_ID = 66702

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def probe_states():
    # Common WispHub states
    states = ["En camino", "En sitio", "Llegado", "En proceso", "Atendido"]
    
    results = []
    
    for state in states:
        url = f"{BASE_URL}/tickets/{TICKET_ID}/"
        print(f"Testing state update: {state}")
        try:
            res = requests.patch(url, headers=HEADERS, json={"estado": state})
            print(f"  Status: {res.status_code}")
            results.append({"state": state, "status": res.status_code, "text": res.text[:100]})
        except Exception as e:
            print(f"  Error: {e}")

    # Check the ticket responses after updates
    print("\nChecking ticket responses after updates...")
    res_final = requests.get(f"{BASE_URL}/tickets/{TICKET_ID}/", headers=HEADERS)
    if res_final.status_code == 200:
        data = res_final.json()
        print(f"Ticket {TICKET_ID} now has {len(data.get('respuestas', []))} respuestas.")
        for r in data.get('respuestas', []):
            print(f"  - {r.get('respuesta')}")

    with open('state_probe_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    probe_states()
