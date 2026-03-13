import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66678' # Usamos el que sabemos que existe
BASE_URL = "https://api.wisphub.net/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def probe_net():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/respuestas/"
    print(f"Testing POST {url}")
    payload = {"respuesta": "[PROBE] Test on .net domain"}
    try:
        res = requests.post(url, headers=HEADERS, json=payload, timeout=5)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:500]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    probe_net()
