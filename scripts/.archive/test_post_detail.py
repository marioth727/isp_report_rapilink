import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def get_response_count():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return len(res.json().get('respuestas', []))
    return -1

def run_test():
    initial_count = get_response_count()
    print(f"Número inicial de respuestas: {initial_count}")

    # Test 1: POST to Detail
    url1 = f"{BASE_URL}/tickets/{TICKET_ID}/"
    print(f"Testing POST {url1}")
    files = {'respuesta': (None, 'Prueba POST Detail')}
    res1 = requests.post(url1, headers=HEADERS, files=files)
    print(f"  Status: {res1.status_code}")
    
    # Test 2: POST to /ver/ (Mirroring Web)
    url2 = f"{BASE_URL}/tickets/ver/{TICKET_ID}/"
    print(f"Testing POST {url2}")
    res2 = requests.post(url2, headers=HEADERS, files=files)
    print(f"  Status: {res2.status_code}")

    new_count = get_response_count()
    print(f"Número final de respuestas: {new_count}")
    if new_count > initial_count:
        print("✅ ¡ÉXITO!")

if __name__ == "__main__":
    run_test()
