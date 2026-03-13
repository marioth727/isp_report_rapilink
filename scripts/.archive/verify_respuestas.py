import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def check_respuestas():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        data = res.json()
        respuestas = data.get('respuestas', [])
        print(f"Total respuestas: {len(respuestas)}")
        for idx, r in enumerate(respuestas):
            print(f"[{idx}] {r.get('respuesta')}")
    else:
        print(f"Error fetching ticket: {res.status_code}")

if __name__ == "__main__":
    check_respuestas()
