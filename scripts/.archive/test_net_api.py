import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://wisphub.net/api" # Sin el subdominio 'api.'

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def test_net_api():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    print(f"Testing GET {url}")
    try:
        res = requests.get(url, headers=HEADERS)
        print(f"  Status: {res.status_code}")
        if res.status_code == 200:
            print("  ✅ Wisphub.net API is available!")
            print(res.json().get('asunto'))
        else:
            print(f"  Failed: {res.text[:200]}")
    except Exception as e:
        print(f"  Error: {e}")

if __name__ == "__main__":
    test_net_api()
