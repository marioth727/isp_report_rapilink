import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

ticket_id = "66702"
resp = requests.get(f"{url}/rest/v1/workflow_processes?reference_id=eq.{ticket_id}", headers=headers)

if resp.status_code == 200:
    data = resp.json()
    if data:
        metadata = data[0].get('metadata', {})
        print("KEYS IN METADATA:")
        print(list(metadata.keys()))
        
        # Check specific problematic fields
        print("\nVALUES:")
        print(f"tecnico: {metadata.get('tecnico')} (type: {type(metadata.get('tecnico'))})")
        print(f"tecnico_id: {metadata.get('tecnico_id')}")
        print(f"fecha_inicio: {metadata.get('fecha_inicio')}")
        print(f"fecha_final: {metadata.get('fecha_final')}")
        print(f"fecha_instalacion: {metadata.get('fecha_instalacion')}")
        print(f"fecha_vencimiento: {metadata.get('fecha_vencimiento')}")
        
    else:
        print(f"No process found for ticket {ticket_id}")
else:
    print(f"Error: {resp.status_code} - {resp.text}")
