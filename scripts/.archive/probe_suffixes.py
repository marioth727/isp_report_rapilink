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
    "Content-Type": "application/json",
    "Origin": "https://api.wisphub.io",
    "Referer": "https://api.wisphub.io/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def probe_common_suffixes():
    suffixes = [
        "comentario", "comentarios", "respuesta", "respuestas", 
        "add-comment", "add_comment", "add-response", "add_response",
        "save-comment", "save_comment", "save-respuesta", "save_respuesta",
        "observacion", "observaciones", "llegada", "reportar-llegada"
    ]
    
    results = []
    
    for s in suffixes:
        url = f"{BASE_URL}/tickets/{TICKET_ID}/{s}/"
        print(f"Testing POST {url}")
        try:
            res = requests.post(url, headers=HEADERS, json={"respuesta": "Probe test"})
            print(f"  Status: {res.status_code}")
            results.append({"suffix": s, "status": res.status_code, "text": res.text[:100]})
            if res.status_code == 201 or res.status_code == 200:
                print(f"--- SUCCESS with {s} !!! ---")
                return
        except Exception as e:
            print(f"  Error: {e}")

    with open('suffix_probe_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    probe_common_suffixes()
