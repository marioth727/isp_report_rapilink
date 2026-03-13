import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
TICKET_ID = 66702

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def test_nested_respuestas():
    # 1. Test POST /tickets/{id}/respuestas/
    url = f"{BASE_URL}/tickets/{TICKET_ID}/respuestas/"
    payload = {"respuesta": "Test nested response from script"}
    
    print(f"Testing POST {url}")
    res = requests.post(url, headers=HEADERS, json=payload)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")

    # 2. Test POST /tickets/{id}/comentarios/
    url_com = f"{BASE_URL}/tickets/{TICKET_ID}/comentarios/"
    print(f"\nTesting POST {url_com}")
    res_com = requests.post(url_com, headers=HEADERS, json=payload)
    print(f"Status: {res_com.status_code}")
    print(f"Response: {res_com.text}")

if __name__ == "__main__":
    test_nested_respuestas()
