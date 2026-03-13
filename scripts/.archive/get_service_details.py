import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.net/api"
SERVICE_ID = 5832

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def get_details():
    url = f"{BASE_URL}/clientes/{SERVICE_ID}/"
    print(f"Fetching {url}")
    res = requests.get(url, headers=HEADERS)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        with open('service_details.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Service details saved to service_details.json")
        # Print potential client IDs
        for key in ['id_cliente', 'cliente', 'usuario', 'id_usuario', 'id_cliente_wisphub']:
            if key in data:
                print(f"Found {key}: {data[key]}")
            elif isinstance(data.get(key), dict):
                print(f"Found {key} object: {data[key].get('id') or data[key].get('id_cliente')}")
    else:
        print(f"Error: {res.text}")

if __name__ == "__main__":
    get_details()
