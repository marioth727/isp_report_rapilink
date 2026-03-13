import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv('VITE_SUPABASE_URL')
# Use SERVICE_ROLE_KEY if available for higher permissions
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

print(f"Checking URL: {url}")
print(f"Using key type: {'SERVICE_ROLE' if os.getenv('SUPABASE_SERVICE_ROLE_KEY') else 'ANON'}")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

try:
    # 1. Check for execute_sql RPC
    resp = requests.post(f"{url}/rest/v1/rpc/execute_sql", headers=headers, json={"query": "SELECT 1"})
    print(f"RPC execute_sql status: {resp.status_code}")
    if resp.status_code == 200:
        print("Success! execute_sql is available.")
    else:
        print(f"execute_sql failed: {resp.text}")

    # 2. Check for other common RPCs if any
    # (Just an example)
    
    # 3. List all exposed RPCs from OpenAPI spec
    resp_api = requests.get(f"{url}/rest/v1/", headers=headers)
    if resp_api.status_code == 200:
        data = resp_api.json()
        paths = data.get('paths', {})
        print("Exposed RPCs:")
        for path in paths:
            if path.startswith('/rpc/'):
                print(f" - {path}")
    else:
        print(f"Could not fetch API definition: {resp_api.status_code}")

except Exception as e:
    print(f"Error: {e}")
