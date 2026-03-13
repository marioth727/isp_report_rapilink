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

try:
    resp = requests.get(f"{url}/rest/v1/", headers=headers)
    if resp.status_code == 200:
        data = resp_api = resp.json()
        post_info = data.get('paths', {}).get('/rpc/execute_sql', {}).get('post', {})
        parameters = post_info.get('parameters', [])
        print("Parameters for /rpc/execute_sql:")
        for param in parameters:
            print(f" - {param.get('name')} ({param.get('type')})")
        
        # Also let's see the schema/body requirement
        print("Body info:", post_info.get('requestBody'))
    else:
        print(f"Error: {resp.status_code}")
except Exception as e:
    print(f"Error: {e}")
