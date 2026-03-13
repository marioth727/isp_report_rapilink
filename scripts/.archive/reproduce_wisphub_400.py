import os
import requests
from dotenv import load_dotenv

load_dotenv()

key = os.getenv('VITE_WISPHUB_API_KEY')
ticket_id = "66702" # From the screenshot

headers = {
    "Api-Key": key,
    "Content-Type": "application/json"
}

# 1. Get current description
url_get = f"https://api.wisphub.io/api/tickets/{ticket_id}/"
print(f"Fetching ticket {ticket_id}...")
resp_get = requests.get(url_get, headers=headers)
if resp_get.status_code != 200:
    print(f"Failed to fetch: {resp_get.status_code} {resp_get.text}")
    exit()

ticket = resp_get.json()
current_desc = ticket.get('descripcion', '')
print(f"Current description: {current_desc[:50]}...")

# 2. Try update with plain text and NEWLINE
new_note = "\n[SISTEMA]: El tecnico ha reportado llegada al sitio."
payload = {
    "descripcion": current_desc + new_note
}

print(f"Attempting update with plain text...")
resp_patch = requests.patch(url_get, headers=headers, json=payload)
print(f"PATCH status: {resp_patch.status_code}")
if resp_patch.status_code != 200:
    print(f"PATCH failed: {resp_patch.text}")
else:
    print("PATCH success!")
