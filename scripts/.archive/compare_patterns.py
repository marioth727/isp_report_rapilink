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

def compare_comment_endpoints():
    # 1. GET from tickets/comentarios/
    url1 = f"{BASE_URL}/tickets/comentarios/?ticket={TICKET_ID}"
    print(f"Fetching {url1}")
    res1 = requests.get(url1, headers=HEADERS)
    print(f"Status 1: {res1.status_code}")
    data1 = res1.json() if res1.status_code == 200 else None
    
    # 2. GET from ticket detail
    url2 = f"{BASE_URL}/tickets/{TICKET_ID}/"
    print(f"Fetching {url2}")
    res2 = requests.get(url2, headers=HEADERS)
    print(f"Status 2: {res2.status_code}")
    data2 = res2.json().get('respuestas') if res2.status_code == 200 else None

    # Print summary
    print(f"\nResults for Ticket {TICKET_ID}:")
    if data1:
        print(f"Endpoint /tickets/comentarios/?ticket={TICKET_ID} returned {len(data1.get('results', [])) if isinstance(data1, dict) else len(data1)} items.")
        print(f"Sample from /tickets/comentarios/: {json.dumps(data1, indent=2)[:200]}...")
    else:
        print("Endpoint /tickets/comentarios/ failed or empty.")

    if data2:
        print(f"Ticket Detail 'respuestas' has {len(data2)} items.")
        print(f"Sample from respuestas: {json.dumps(data2, indent=2)[:200]}...")
    else:
        print("Ticket Detail has no respuestas.")

    # Save details
    with open('pattern_comparison.json', 'w', encoding='utf-8') as f:
        json.dump({"from_comentarios": data1, "from_ticket": data2}, f, indent=2)

if __name__ == "__main__":
    compare_comment_endpoints()
