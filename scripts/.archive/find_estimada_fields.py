import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}'
}

# Fetch metadata for ticket 66702
r = requests.get(f'{url}/rest/v1/workflow_processes?reference_id=eq.66702', headers=headers)
data = r.json()

if not data:
    print("No data found for ticket 66702")
    exit()

m = data[0].get('metadata', {})

def search(obj, path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_path = f"{path}.{k}" if path else k
            # Search for values matching the screenshot (14:38, 16/02, 17/02)
            # or keys related to dates or "estimada"
            if ('14:38' in str(v) or 
                '16/02' in str(v) or 
                '17/02' in str(v) or 
                'estimada' in k.lower() or 
                'fecha' in k.lower() or 
                'date' in k.lower()):
                print(f"{new_path}: {v}")
            search(v, new_path)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            search(v, f"{path}[{i}]")

print("--- Searching Metadata for Date Fields ---")
search(m)
