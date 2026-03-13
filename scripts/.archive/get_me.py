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

def get_me():
    # Try different common 'me' endpoints
    endpoints = ["/staff/me/", "/perfil/", "/user/", "/auth/user/"]
    for e in endpoints:
        url = f"{BASE_URL}{e}"
        print(f"Testing {url}")
        res = requests.get(url, headers=HEADERS)
        if res.status_code == 200:
            print(f"--- SUCCESS ON {e} ---")
            print(res.json())
            return
    print("Could not find 'me' endpoint.")

if __name__ == "__main__":
    get_me()
