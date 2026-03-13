import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL_V1 = "https://api.wisphub.io/api/v1"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def test_v1():
    url = f"{BASE_URL_V1}/tickets/{TICKET_ID}/"
    print(f"Testing GET {url}")
    try:
        res = requests.get(url, headers=HEADERS)
        print(f"  Status: {res.status_code}")
        if res.status_code == 200:
            print("  ✅ v1 endpoint is available!")
            
            payload = {
                "respuestas": [
                    {
                        "respuesta": "Prueba v1 API Agent"
                    }
                ]
            }
            res_patch = requests.patch(url, headers=HEADERS, json=payload)
            print(f"  PATCH Status: {res_patch.status_code}")
            
            # Check
            res_after = requests.get(url, headers=HEADERS)
            new_count = len(res_after.json().get('respuestas', []))
            print(f"  Final count: {new_count}")
        else:
            print(f"  Failed: {res.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

if __name__ == "__main__":
    test_v1()
