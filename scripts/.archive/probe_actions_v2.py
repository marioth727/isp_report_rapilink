import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66678'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def probe_actions():
    # Common action-based suffixes in ISP/DRF apps
    suffixes = [
        "add_comentario/", "add-comentario/", "agregar_comentario/",
        "add_respuesta/", "add-respuesta/", "agregar_respuesta/",
        "save_respuesta/", "save-respuesta/", "guardar_respuesta/",
        "responder/", "comentar/", "actions/add_respuesta/",
        "respuestas/", "comentarios/"
    ]
    
    for s in suffixes:
        # Style 1: Nested under ticket detail
        url1 = f"{BASE_URL}/tickets/{TICKET_ID}/{s}"
        # Style 2: Global with ticket in body
        url2 = f"{BASE_URL}/{s}"
        
        for url in [url1, url2]:
            print(f"Testing {url}")
            try:
                # Use a dummy POST to see if it's 404 or something else
                payload = {"ticket": TICKET_ID, "respuesta": "Probe", "comentario": "Probe"}
                res = requests.post(url, headers=HEADERS, json=payload, timeout=3)
                print(f"  Status: {res.status_code}")
                if res.status_code < 400:
                    print(f"  ✅ SUCCESS on {url}!")
                    return
            except Exception:
                pass

if __name__ == "__main__":
    probe_actions()
