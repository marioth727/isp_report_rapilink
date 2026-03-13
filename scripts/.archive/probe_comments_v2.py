import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY') or os.getenv('WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.io/api"

if not API_KEY:
    print("Error: No API Key found")
    exit(1)

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def get_recent_ticket():
    print(f"Fetching a recent ticket from {BASE_URL}...")
    try:
        res = requests.get(f"{BASE_URL}/tickets/?limit=1", headers=HEADERS)
        if res.status_code == 200:
            data = res.json()
            results = data if isinstance(data, list) else data.get('results', [])
            if results:
                return results[0]
            else:
                print("No tickets found.")
    except Exception as e:
        print(f"Error fetching ticket: {e}")
    return None

def log(msg):
    with open('probe.log', 'a') as f:
        f.write(msg + '\n')
    print(msg)

def probe_endpoints(ticket_id):
    log(f"\n--- Probing endpoints for Ticket {ticket_id} ---")
    potential_paths = [
        f"tickets/{ticket_id}/respuestas/",
        f"tickets/{ticket_id}/respuesta/",
        f"tickets/{ticket_id}/comentarios/",
        f"tickets/{ticket_id}/comentario/",
        f"tickets/{ticket_id}/log/",
        f"tickets/{ticket_id}/history/",
        f"tickets/{ticket_id}/timeline/",
        f"v1/tickets/{ticket_id}/respuestas/",
        f"v1/tickets/{ticket_id}/comentarios/",
        f"v1/tickets/respuestas/",
        f"v1/tickets/comentarios/",
        f"tickets/respuestas/",
        f"tickets/comentarios/",
        f"comentarios/",
        f"respuestas/"
    ]

    log(f"Checking OPTIONS on {BASE_URL}/tickets/{ticket_id}/ ...")
    try:
        res_opt = requests.options(f"{BASE_URL}/tickets/{ticket_id}/", headers=HEADERS)
        log(f"OPTIONS Status: {res_opt.status_code}")
        log(f"Allow Header: {res_opt.headers.get('Allow')}")
    except Exception as e:
        log(f"Error checking OPTIONS: {e}")

    for path in potential_paths:
        url = f"{BASE_URL}/{path}"
        log(f"\nProbing GET {url}...")
        try:
            res = requests.get(url, headers=HEADERS)
            log(f"GET Status: {res.status_code}")
            
            # Try POST regardless of GET status if it's a 404 or 405
            if res.status_code in [200, 404, 405]:
                log(f"Attempting POST (JSON) to {url}...")
                payload = {
                     "ticket": ticket_id,
                     "comentario": "Test probe JSON",
                     "respuesta": "Test probe JSON"
                }
                res_post = requests.post(url, headers=HEADERS, json=payload)
                log(f"POST (JSON) Status: {res_post.status_code}")
                if res_post.status_code in [200, 201]:
                     log("SUCCESSful POST (JSON)!")
                     return url

                log(f"Attempting POST (Form-Data) to {url}...")
                files = {
                    'ticket': (None, str(ticket_id)),
                    'comentario': (None, "Test probe Form-Data"),
                    'respuesta': (None, "Test probe Form-Data")
                }
                res_post_f = requests.post(url, headers={"Authorization": f"Api-Key {API_KEY}"}, files=files)
                log(f"POST (Form-Data) Status: {res_post_f.status_code}")
                if res_post_f.status_code in [200, 201]:
                     log("SUCCESSful POST (Form-Data)!")
                     return url
        except Exception as e:
            log(f"Error probing {url}: {e}")

ticket = get_recent_ticket()
if ticket:
    print(f"Ticket Data Keys: {list(ticket.keys())}")
    # Print potential URL keys
    url_keys = [k for k in ticket.keys() if 'url' in k.lower()]
    print(f"URL Hint Keys: {url_keys}")
    for k in url_keys:
        print(f"  {k}: {ticket[k]}")

    with open('temp_ticket.json', 'w') as f:
        json.dump(ticket, f, indent=2)
    print("Dumped ticket to temp_ticket.json")

    probe_endpoints(ticket['id_ticket'])
    
    # Test PATCH on ticket itself
    ticket_url = f"{BASE_URL}/tickets/{ticket['id_ticket']}/"
    log(f"\n--- Probing PATCH on {ticket_url} ---")
    keys_to_test = ["comentario", "nota", "respuesta", "body", "text", "observacion"]
    
    for key in keys_to_test:
        log(f"Testing PATCH with key '{key}'...")
        payload = { key: f"Test Probe {key}" }
        try:
            res = requests.patch(ticket_url, headers=HEADERS, json=payload)
            log(f"PATCH Status: {res.status_code}")
            log(f"Response: {res.text[:200]}")
            if res.status_code == 200:
                # Check if it was added
                res_get = requests.get(ticket_url, headers=HEADERS)
                if f"Test Probe {key}" in res_get.text:
                    log(f"SUCCESS: '{key}' appended to ticket!")
                    break
        except Exception as e:
            log(f"Error testing PATCH: {e}")

    # Test Append Mode (Fetch -> Append -> Patch)
    ticket_url = f"{BASE_URL}/tickets/{ticket['id_ticket']}/"
    log(f"\n--- Probing APPEND MODE on {ticket_url} ---")
    try:
        # Fetch current
        res_current = requests.get(ticket_url, headers=HEADERS)
        current_data = res_current.json()
        current_comentarios = current_data.get('comentarios', '') or ""
        
        log(f"Current length: {len(current_comentarios)}")
        
        test_string = f"\n[PROBE]: Test Append Mode {datetime.now()}"
        new_comentarios = current_comentarios + test_string
        
        res_patch = requests.patch(ticket_url, headers=HEADERS, json={"comentarios": new_comentarios})
        log(f"PATCH Append Status: {res_patch.status_code}")
        
        if res_patch.status_code == 200:
             # Verify
             res_verify = requests.get(ticket_url, headers=HEADERS)
             if test_string in res_verify.text:
                 log("SUCCESS: Append Mode WORKED!")
             else:
                 log("FAILED: Append Mode returned 200 but text not found.")
    except Exception as e:
        log(f"Error testing APPEND MODE: {e}")

    # Service Probes
    if 'servicio' in ticket and ticket['servicio']:
        service_id = ticket['servicio']['id_servicio']
        log(f"\n--- Probing endpoints for Service {service_id} ---")
        
        # PROBE SERVICE PATCH
        service_url = f"{BASE_URL}/servicios/{service_id}/"
        log(f"Fetching Service from {service_url}...")
        try:
             res_serv = requests.get(service_url, headers=HEADERS)
             log(f"GET Service Status: {res_serv.status_code}")
             if res_serv.status_code == 200:
                 serv_data = res_serv.json()
                 curr_com = serv_data.get('comentarios', '') or ""
                 log(f"Service Comentarios Length: {len(curr_com)}")
                 
                 # Try Append Patch
                 test_msg = f"\n[PROBE_SERV]: Append to Service {datetime.now()}"
                 new_com = curr_com + test_msg
                 
                 log(f"Attempting PATCH to {service_url}...")
                 res_patch = requests.patch(service_url, headers=HEADERS, json={"comentarios": new_com})
                 log(f"PATCH Status: {res_patch.status_code}")
                 
                 if res_patch.status_code == 200:
                     # Verify
                     res_v = requests.get(service_url, headers=HEADERS)
                     if test_msg in res_v.text:
                         log("SUCCESS: Service Comment Appended!")
                     else:
                         log("FAILED: Service PATCH 200 but text not found.")
        except Exception as e:
             log(f"Error probing Service PATCH: {e}")
             
        service_paths = [
            f"servicios/{service_id}/comentarios/",
            f"servicios/{service_id}/notas/",
            f"servicios/{service_id}/comments/",
            f"services/{service_id}/comments/",
            f"v1/tickets/{ticket_id}/comentarios/",
            f"v1/tickets/{ticket_id}/respuestas/",
        ]
        for path in service_paths:
            url = f"{BASE_URL}/{path}"
            log(f"\nProbing GET {url}...")
            try:
                res = requests.get(url, headers=HEADERS)
                log(f"GET Status: {res.status_code}")
                if res.status_code == 200:
                    log(f"FOUND GET endpoint! Response preview: {res.text[:100]}")
            except Exception as e:
                log(f"Error probing {url}: {e}")
else:
    print("No ticket to test.")
