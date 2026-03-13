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

def parse_wisphub_date(date_str):
    if not date_str: return 'EMPTY'
    try:
        if 'p. m.' in date_str.lower() or 'a. m.' in date_str.lower():
            # "16/02/2026 07:41 p. m."
            parts = date_str.split(' ')
            date_parts = parts[0].split('/')
            time_parts = parts[1].split(':')
            hours = int(time_parts[0])
            minutes = time_parts[1]
            
            if 'p. m.' in date_str.lower() and hours < 12: hours += 12
            if 'a. m.' in date_str.lower() and hours == 12: hours = 0
            
            return f"{date_parts[2]}-{date_parts[1]}-{date_parts[0]}T{hours:02d}:{minutes}"
        return f"NOT_PARSED: {date_str}"
    except Exception as e:
        return f"ERROR: {str(e)}"

if resp.status_code == 200:
    data = resp.json()
    if data:
        metadata = data[0].get('metadata', {})
        print("--- RAW METADATA ---")
        print(json.dumps(metadata, indent=2))
        
        print("\n--- MAPPING TEST ---")
        print(f"Asunto: {metadata.get('asunto')}")
        print(f"Tecnico ID (metadata.tecnico.id): {metadata.get('tecnico', {}).get('id') if isinstance(metadata.get('tecnico'), dict) else 'N/A'}")
        print(f"Tecnico ID (metadata.tecnico_id): {metadata.get('tecnico_id')}")
        print(f"Fecha Inicio: {metadata.get('fecha_inicio')} -> {parse_wisphub_date(metadata.get('fecha_inicio'))}")
        print(f"Fecha Final: {metadata.get('fecha_final')} -> {parse_wisphub_date(metadata.get('fecha_final'))}")
        print(f"Fecha Instalación: {metadata.get('fecha_instalacion')} -> {parse_wisphub_date(metadata.get('fecha_instalacion'))}")
        
    else:
        print(f"No process found for ticket {ticket_id}")
else:
    print(f"Error: {resp.status_code} - {resp.text}")
