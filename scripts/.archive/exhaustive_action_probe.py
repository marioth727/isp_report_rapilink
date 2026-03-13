import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def probe_all_variations():
    variations = [
        "respuesta", "comentario", "respuestas", "comentarios",
        "add_respuesta", "add_comentario", "responder", "comentar",
        "save_respuesta", "save_comentario"
    ]
    
    for v in variations:
        # Test with and without trailing slash
        for suffix in [f"{v}/", f"{v}"]:
            url = f"{BASE_URL}/tickets/{TICKET_ID}/{suffix}"
            print(f"Testing POST {url}")
            try:
                res = requests.post(url, headers=HEADERS, json={"respuesta": "Exhaustive Probe"}, timeout=3)
                print(f"  Status: {res.status_code}")
                if res.status_code < 400:
                    print(f"--- SUCCESS with {url} !!! ---")
                    return
            except Exception:
                pass

if __name__ == "__main__":
    probe_all_variations()
