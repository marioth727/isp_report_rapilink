import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def test_string():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    payload = {
        "respuestas": "Prueba de Respuesta como STRING Simple"
    }
    print(f"Testing PATCH {url} with string payload")
    try:
        res = requests.patch(url, headers=HEADERS, json=payload)
        print(f"  Status: {res.status_code}")
        print(f"  Response: {res.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

if __name__ == "__main__":
    test_string()
