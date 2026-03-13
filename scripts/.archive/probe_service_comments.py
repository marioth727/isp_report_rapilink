import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
SERVICE_ID = 4080

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def probe_service_comments():
    paths = [
        f"/servicios/{SERVICE_ID}/comentarios/",
        f"/servicios/{SERVICE_ID}/notas/",
        f"/clientes/{SERVICE_ID}/comentarios/",
        f"/clientes/{SERVICE_ID}/notas/"
    ]
    
    results = []
    
    for path in paths:
        url = BASE_URL + path
        print(f"Testing POST {url}")
        try:
            res = requests.post(url, headers=HEADERS, json={"comentario": "Test from pattern probe"})
            print(f"  Status: {res.status_code}")
            results.append({"url": url, "status": res.status_code, "text": res.text[:100]})
        except Exception as e:
            print(f"  Error: {e}")

    with open('service_comment_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    probe_service_comments()
