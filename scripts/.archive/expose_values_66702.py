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
        print("--- FULL METADATA KEYS ---")
        print(list(metadata.keys()))
        
        print("\n--- CONTENT ---")
        for k, v in metadata.items():
            if k == 'servicio_completo':
                print(f"{k}: keys={list(v.keys())}")
                if 'tecnico' in v: print(f"  SC.tecnico: {v['tecnico']}")
                if 'nombre_tecnico' in v: print(f"  SC.nombre_tecnico: {v['nombre_tecnico']}")
                if 'tecnico_id' in v: print(f"  SC.tecnico_id: {v['tecnico_id']}")
                if 'ejecutor' in v: print(f"  SC.ejecutor: {v['ejecutor']}")
                if 'fecha_instalacion' in v: print(f"  SC.fecha_instalacion: {v['fecha_instalacion']}")
            else:
                print(f"{k}: {v}")
    else:
        print(f"No process found for ticket {ticket_id}")
else:
    print(f"Error: {resp.status_code} - {resp.text}")
