import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"
TICKET_ID = 66666

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def analyze_ticket_66666():
    results = {}
    
    # 1. Fetch Ticket Detail
    ticket_url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    print(f"Fetching Ticket Detail: {ticket_url}")
    res_ticket = requests.get(ticket_url, headers=HEADERS)
    if res_ticket.status_code == 200:
        results['ticket_detail'] = res_ticket.json()
        print("Success: Ticket Detail fetched.")
    else:
        print(f"Error fetching ticket: {res_ticket.status_code} - {res_ticket.text}")

    # 2. Fetch Comments/Responses
    # From wisphub.ts: getTicketComments(ticketId) -> ${BASE_URL}/tickets/comentarios/?ticket=${ticketId}
    comments_url = f"{BASE_URL}/tickets/comentarios/?ticket={TICKET_ID}"
    print(f"Fetching Comments: {comments_url}")
    res_comments = requests.get(comments_url, headers=HEADERS)
    if res_comments.status_code == 200:
        results['comments'] = res_comments.json()
        print("Success: Comments fetched.")
    else:
        print(f"Error fetching comments: {res_comments.status_code} - {res_comments.text}")

    # 3. Save to file
    with open('analysis_ticket_66666.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    print("Analysis saved to analysis_ticket_66666.json")

if __name__ == "__main__":
    analyze_ticket_66666()
