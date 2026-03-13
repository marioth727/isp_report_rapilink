import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.net/api" # Using .net as it worked for listing before

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def list_tickets():
    url = f"{BASE_URL}/tickets/?limit=1"
    print(f"Fetching {url}")
    res = requests.get(url, headers=HEADERS)
    print(f"Status: {res.status_code}")
    if res.status_code == 200:
        data = res.json()
        with open('latest_ticket.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Latest ticket saved to latest_ticket.json")
    else:
        print(f"Error: {res.text}")

if __name__ == "__main__":
    list_tickets()
