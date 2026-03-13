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
    "Accept": "application/json"
}

def search_client_for_service():
    # Try direct filter
    url = f"{BASE_URL}/clientes/?id_servicio={SERVICE_ID}"
    print(f"Searching {url}")
    res = requests.get(url, headers=HEADERS)
    print(f"Status: {res.status_code}")
    
    if res.status_code == 200:
        data = res.json()
        results = data.get('results', [])
        print(f"Found {len(results)} matches.")
        
        for client in results:
            if client.get('id_servicio') == SERVICE_ID:
                print(f"\n--- MATCH FOUND ---")
                print(f"Client Name: {client.get('nombre')}")
                print(f"id_servicio: {client.get('id_servicio')}")
                # Look for potential client identifiers
                print(f"Potential Client IDs:")
                # Some WispHub versions use 'id' or 'id_cliente' inside the result
                for key in client.keys():
                    if 'id' in key.lower() or 'cliente' in key.lower():
                        print(f"  {key}: {client[key]}")
                
                with open('client_5832_match.json', 'w', encoding='utf-8') as f:
                    json.dump(client, f, indent=2)
                return
        print("No exact id_servicio match found in search results.")
    else:
        print(f"Error: {res.text}")

if __name__ == "__main__":
    search_client_for_service()
