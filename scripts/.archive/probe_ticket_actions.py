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

def probe_actions():
    # Common DRF action names
    actions = [
        "responder", "comentar", "save_respuesta", "save_comentario",
        "add_respuesta", "add_comentario", "responses", "replies"
    ]
    
    for a in actions:
        url = f"{BASE_URL}/tickets/{TICKET_ID}/{a}/"
        print(f"Testing POST {url}")
        try:
            res = requests.post(url, headers=HEADERS, json={
                "respuesta": "Action probe"
            })
            print(f"  Status: {res.status_code}")
            if res.status_code < 400:
                print(f"--- SUCCESS with {url} !!! ---")
                print(res.text)
                return
        except Exception as ex:
            print(f"  Error: {ex}")

if __name__ == "__main__":
    probe_actions()
