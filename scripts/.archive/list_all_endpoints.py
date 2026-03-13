import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def list_endpoints():
    url = f"{BASE_URL}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        data = res.json()
        print("--- API ENDPOINTS ---")
        for k in sorted(data.keys()):
            print(f"{k}: {data[k]}")
    else:
        print(f"Error: {res.status_code}")

if __name__ == "__main__":
    list_endpoints()
