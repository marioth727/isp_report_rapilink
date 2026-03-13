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

def probe_all():
    suffixes = [
        "respuestas/", "respuesta/", "comentarios/", "comentario/",
        "respuestas-tickets/", "tickets-respuestas/", "responder/",
        "save_respuesta/", "add_respuesta/"
    ]
    
    paths = []
    # Nested paths
    for s in suffixes:
        paths.append(f"{BASE_URL}/tickets/{TICKET_ID}/{s}")
    
    # Global paths
    for s in suffixes:
        paths.append(f"{BASE_URL}/{s}")
        
    for url in paths:
        print(f"\n--- Probando: {url} ---")
        try:
            # 1. Try OPTIONS
            r_opt = requests.options(url, headers=HEADERS, timeout=5)
            print(f"  OPTIONS Status: {r_opt.status_code}")
            
            # 2. Try POST with minimal payload
            payload = {"ticket": TICKET_ID, "respuesta": "[PROBE] Test"}
            r_post = requests.post(url, headers=HEADERS, json=payload, timeout=5)
            print(f"  POST Status: {r_post.status_code}")
            if r_post.status_code < 400:
                print(f"  ✅ SUCCESS: {r_post.text[:200]}")
                return
            elif r_post.status_code == 400:
                print(f"  ❌ Bad Request: {r_post.text[:200]}")
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    probe_all()
