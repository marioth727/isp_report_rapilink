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

def verify_self():
    # Attempt to fetch own user info or just list staff to see if we are there
    url = f"{BASE_URL}/staff/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        print("API Key is VALID.")
        # Some APIs have a 'me' or similar. WispHub might not.
        # But we can try to guess who we are by permissions.
    else:
        print(f"API Key might be invalid or restricted: {res.status_code}")

if __name__ == "__main__":
    verify_self()
