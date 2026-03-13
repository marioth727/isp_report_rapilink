import os
import requests
from dotenv import load_dotenv

load_dotenv()

key = os.getenv('VITE_WISPHUB_API_KEY')
ticket_id = "66702"

headers = {
    "Api-Key": key
}

try:
    url = f"https://api.wisphub.io/api/tickets/{ticket_id}/"
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        ticket = resp.json()
        print(f"Description for ticket {ticket_id}:")
        print(ticket.get('descripcion', ''))
    else:
        print(f"Failed to fetch: {resp.status_code} {resp.text}")
except Exception as e:
    print(f"Error: {e}")
