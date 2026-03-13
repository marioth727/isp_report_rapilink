import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv('VITE_SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

test_payload = {
    "ticket_id": "TEST_REPAIR",
    "event_type": "arrival",
    "metadata": {"test": True, "message": "Verification from Antigravity"}
}

try:
    print(f"Testing insertion on {url}...")
    resp = requests.post(f"{url}/rest/v1/ticket_events", headers=headers, json=test_payload)
    print(f"Status: {resp.status_code}")
    if resp.status_code in [201, 204, 200]:
        print("✅ Insertion successful!")
        
        # Verify it exists
        resp_check = requests.get(f"{url}/rest/v1/ticket_events?ticket_id=eq.TEST_REPAIR", headers=headers)
        print(f"Verification query result: {resp_check.text}")
    else:
        print(f"❌ Insertion failed: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
