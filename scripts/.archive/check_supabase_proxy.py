import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv('VITE_SUPABASE_URL')
key = os.getenv('VITE_SUPABASE_ANON_KEY')

print(f"Checking URL: {url}")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

try:
    # Try to list tables via PostgREST /rpc/get_tables or just check /rest/v1/
    # Actually, let's just try to hit ticket_events directly with a SELECT
    resp = requests.get(f"{url}/rest/v1/ticket_events?limit=1", headers=headers)
    print(f"Status Code for ticket_events: {resp.status_code}")
    print(f"Response: {resp.text}")
    
    # Also check profiles to see if basic REST works
    resp_profiles = requests.get(f"{url}/rest/v1/profiles?limit=1", headers=headers)
    print(f"Status Code for profiles: {resp_profiles.status_code}")
    
    # Try to see all tables if possible (sometimes exposed)
    # PostgREST documentation says we can hit the root to get the OpenAPI spec
    resp_api = requests.get(f"{url}/rest/v1/", headers=headers)
    if resp_api.status_code == 200:
        print("API Definition found. Tables list:")
        data = resp_api.json()
        definitions = data.get('definitions', {})
        for table in definitions:
            print(f" - {table}")
    else:
        print(f"Could not fetch API definition: {resp_api.status_code}")

except Exception as e:
    print(f"Error: {e}")
