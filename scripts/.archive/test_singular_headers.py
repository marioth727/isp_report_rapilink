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
    "Content-Type": "application/json",
    "Origin": "https://api.wisphub.io",
    "Referer": "https://api.wisphub.io/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def test_singular_respuesta_with_headers():
    # Test POST /tickets/respuesta/ (singular)
    url = f"{BASE_URL}/tickets/respuesta/"
    payload = {
        "ticket": TICKET_ID,
        "respuesta": "Test singular pattern with production headers"
    }
    
    print(f"Testing POST {url}")
    try:
        res = requests.post(url, headers=HEADERS, json=payload)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text[:500]}")
        if res.status_code == 201:
            print("--- SUCCESS !!! ---")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_singular_respuesta_with_headers()
