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

def test_singular_respuesta():
    # Test POST /tickets/respuesta/ (singular)
    url = f"{BASE_URL}/tickets/respuesta/"
    payload = {
        "ticket": TICKET_ID,
        "respuesta": "Test singular pattern from script"
    }
    
    print(f"Testing POST {url}")
    try:
        res = requests.post(url, headers=HEADERS, json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
        if res.status_code == 201:
            print("--- SUCCESS !!! ---")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_singular_respuesta()
