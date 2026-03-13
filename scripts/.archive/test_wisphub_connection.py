import os
import requests
import json
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv(dotenv_path='../.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY') or os.getenv('WISPHUB_API_KEY')

if not API_KEY:
    print("Error: No API Key found in .env")
    exit(1)

print(f"API Key found: {API_KEY[:5]}...")

BASE_URLS = [
    "https://api.wisphub.net/api",
    "https://api.wisphub.io/api",
    "https://sandbox-api.wisphub.net/api"
]

def test_connection():
    for base_url in BASE_URLS:
        print(f"\nTesting connection to: {base_url} ...")
        try:
            # Intentar obtener 1 ticket para verificar auth y endpoint
            response = requests.get(
                f"{base_url}/tickets/?limit=1",
                headers={
                    "Authorization": f"Api-Key {API_KEY}",
                    "Accept": "application/json"
                },
                timeout=10
            )
            
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print(f"SUCCESS! Connected to {base_url}")
                data = response.json()
                results = data.get('results', [])
                if results:
                    ticket_id = results[0].get('id_ticket') or results[0].get('id')
                    print(f"Found ticket ID: {ticket_id}")
                    return base_url, ticket_id
                else:
                    print("Connected but no tickets found.")
                    return base_url, None
            else:
                print(f"Failed. Response: {response.text[:200]}")
        except Exception as e:
            print(f"Exception connecting to {base_url}: {e}")

    return None, None

valid_url, ticket_id = test_connection()

if valid_url:
    print(f"\n--- CONCLUSION ---")
    print(f"The correct Base URL is: {valid_url}")
    
    # Recomendar actualización de vite.config.ts si es necesario
    current_vite_proxy = "https://api.wisphub.io" # Hardcoded based on reading vite.config.ts
    if "wisphub.net" in valid_url:
        print(f"WARNING: vite.config.ts uses {current_vite_proxy}, but the working URL is {valid_url}")
        print("Action Item: Update vite.config.ts target.")
else:
    print("\n--- CONCLUSION ---")
    print("Could not connect to any WispHub API URL. Check API Key or Network.")
