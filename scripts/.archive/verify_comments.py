import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
TICKET_ID = 66702
SERVICE_ID = 5832 # From temp_ticket.json

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def test():
    url = f"{BASE_URL}/tickets/comentarios/"
    print(f"Testing POST {url}")
    
    # Try multiple payload variations
    variations = [
        {"ticket": TICKET_ID, "comentario": "Test JSON ticket"},
        {"ticket": TICKET_ID, "comentario": "Test JSON + service", "id_servicio": SERVICE_ID},
        {"ticket": TICKET_ID, "comentario": "Test JSON + client", "id_cliente": SERVICE_ID},
        {"id_ticket": TICKET_ID, "comentario": "Test JSON id_ticket"},
    ]
    
    for i, payload in enumerate(variations):
        print(f"\n--- Variation {i}: {payload} ---")
        res = requests.post(url, headers=HEADERS, json=payload)
        print(f"Status: {res.status_code}")
        if "html" in res.headers.get('Content-Type', '').lower():
            print("Response is HTML. Saving to error.html")
            with open(f'error_{i}.html', 'w', encoding='utf-8') as f:
                f.write(res.text)
            # Look for errors in HTML
            if "Falta" in res.text:
                start = res.text.find("Falta")
                print(f"Found error clue: {res.text[start:start+100]}")
        else:
            print(f"Response (JSON?): {res.text[:200]}")

    # Also try Form-Data variation with all fields
    print("\n--- Testing Form-Data with multiple fields ---")
    files = {
        'ticket': (None, str(TICKET_ID)),
        'comentario': (None, "Test Form-Data + all fields"),
        'id_servicio': (None, str(SERVICE_ID)),
        'cliente': (None, str(SERVICE_ID))
    }
    res_f = requests.post(url, headers={"Authorization": f"Api-Key {API_KEY}"}, files=files)
    print(f"Status: {res_f.status_code}")
    print(f"Response sample: {res_f.text[:200]}")

if __name__ == "__main__":
    test()
