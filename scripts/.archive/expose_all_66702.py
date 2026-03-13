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
        print("ALL METADATA KEYS:")
        print(list(metadata.keys()))
        
        for k, v in metadata.items():
            if v and not isinstance(v, dict):
                print(f"{k}: {v}")
            elif isinstance(v, dict):
                print(f"{k}: {list(v.keys())}")
    else:
        print(f"No process found for ticket {ticket_id}")
else:
    print(f"Error: {resp.status_code} - {resp.text}")
