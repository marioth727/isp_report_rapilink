import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def get_ticket():
    url = f"{BASE_URL}/tickets/66702/"
    print(f"Fetching {url}")
    res = requests.get(url, headers=HEADERS)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        print(f"Ticket ID: {data.get('id_ticket')}")
        servicio = data.get('servicio', {})
        print(f"Servicio Object Keys: {list(servicio.keys())}")
        print(f"id_servicio: {servicio.get('id_servicio')}")
        print(f"id_cliente_wisphub: {servicio.get('id_cliente_wisphub')}")
        print(f"id_cliente: {servicio.get('id_cliente')}")
        with open('ticket_66702_full.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Ticket 66702 full data saved to ticket_66702_full.json")
    else:
        print(f"Error: {res.text}")

if __name__ == "__main__":
    get_ticket()
