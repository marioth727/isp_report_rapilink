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
        print("--- FULL METADATA STRUCTURE (TRUNCATED SAFE) ---")
        
        # Check servicio_completo
        sc = metadata.get('servicio_completo', {})
        print(f"\nservicio_completo keys: {list(sc.keys())}")
        
        # Look for anything related to technician or dates
        potential_tech_keys = [k for k in metadata.keys() if 'tec' in k.lower()]
        print(f"\nKeys containing 'tec': {potential_tech_keys}")
        for k in potential_tech_keys:
            print(f"- {k}: {metadata.get(k)}")

        potential_date_keys = [k for k in metadata.keys() if 'fech' in k.lower() or 'date' in k.lower()]
        print(f"\nKeys containing 'fech/date': {potential_date_keys}")
        for k in potential_date_keys:
            print(f"- {k}: {metadata.get(k)}")
            
        print("\n--- DEEP CHECK IN servicio_completo ---")
        if sc:
            tech_sc = [k for k in sc.keys() if 'tec' in k.lower()]
            print(f"SC Keys with 'tec': {tech_sc}")
            for k in tech_sc:
                print(f"- {k}: {sc.get(k)}")
    else:
        print(f"No process found for ticket {ticket_id}")
else:
    print(f"Error: {resp.status_code} - {resp.text}")
