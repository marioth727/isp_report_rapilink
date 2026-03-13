import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
SERVICE_ID = 5832

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def search_client():
    url = f"{BASE_URL}/clientes/?search={SERVICE_ID}"
    print(f"Fetching {url}")
    res = requests.get(url, headers=HEADERS)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        with open('client_search.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Client search results saved to client_search.json")
    else:
        print(f"Error: {res.text}")

if __name__ == "__main__":
    search_client()
