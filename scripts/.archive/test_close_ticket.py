import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Simular cierre de ticket con archivo
ticket_id = "66702"
api_key = os.environ.get('WISPHUB_API_KEY')

url = f"https://api.wisphub.net/api/tickets/{ticket_id}/"

# Test 1: Ver qué campos espera la API para PUT
print("=== TEST 1: Fetching current ticket data ===")
r = requests.get(url, headers={'Authorization': f'Api-Key {api_key}'})
if r.status_code == 200:
    current_data = r.json()
    print("Current estado:", current_data.get('estado'))
    print("Current fecha_final:", current_data.get('fecha_final'))
    print("Current archivo_ticket:", current_data.get('archivo_ticket'))
    print("\nAvailable keys:")
    for key in current_data.keys():
        if 'archivo' in key.lower() or 'file' in key.lower() or 'fecha' in key.lower():
            print(f"  - {key}: {current_data.get(key)}")
else:
    print(f"Error fetching ticket: {r.status_code}")
    print(r.text)
