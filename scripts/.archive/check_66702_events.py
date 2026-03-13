import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv('VITE_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

ticket_id = "66702"

try:
    print(f"Checking {url} for events of ticket {ticket_id}...")
    resp = requests.get(f"{url}/rest/v1/ticket_events?ticket_id=eq.{ticket_id}", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Data: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
