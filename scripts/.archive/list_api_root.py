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

def list_root():
    url = f"{BASE_URL}/"
    print(f"Fetching API root: {url}")
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        data = res.json()
        print(f"API ROOT content: {list(data.keys())}")
        for k, v in data.items():
            print(f"  {k}: {v}")
    else:
        print(f"Error fetching root: {res.status_code} - {res.text}")

if __name__ == "__main__":
    list_root()
