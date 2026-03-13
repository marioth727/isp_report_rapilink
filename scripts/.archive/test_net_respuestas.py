import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL_NET = "https://wisphub.net/api"
TICKET_ID = 66666

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def test_net_respuestas():
    # Test POST /tickets/{id}/respuestas/ on .net
    url = f"{BASE_URL_NET}/tickets/{TICKET_ID}/respuestas/"
    payload = {"respuesta": "Test nested response from .net script"}
    
    print(f"Testing POST {url}")
    try:
        res = requests.post(url, headers=HEADERS, json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_net_respuestas()
