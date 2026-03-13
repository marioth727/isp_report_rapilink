import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
TICKET_ID = 66666

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def get_options():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.options(url, headers=HEADERS)
    print(f"Status: {res.status_code}")
    try:
        data = res.json()
        print(json.dumps(data, indent=2))
    except:
        print(res.text[:1000])

if __name__ == "__main__":
    get_options()
