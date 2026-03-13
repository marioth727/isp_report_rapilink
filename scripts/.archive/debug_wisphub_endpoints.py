import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env')

API_KEY = os.getenv('VITE_WISPHUB_API_KEY') or os.getenv('WISPHUB_API_KEY')
BASE_URL = "https://api.wisphub.net/api" # Testing .net

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
            if isinstance(data, list):
                 results = data
            else:
                 results = data.get('results', [])
            
            if results and len(results) > 0:
                print(f"Sample ticket type: {type(results[0])}")
                return results[0]
            else:
                print("No tickets found in results.")
        else:
            print(f"Failed to fetch tickets: {res.status_code}")
    except Exception as e:
        print(f"Error fetching ticket: {e}")
    return None

def test_comment_endpoints(ticket_id):
    print(f"\n--- Testing Comment Endpoints for Ticket {ticket_id} ---")
    
    endpoints = [
        f"{BASE_URL}/tickets/{ticket_id}/respuestas/",
        f"{BASE_URL}/tickets/respuestas/",
        f"{BASE_URL}/tickets/{ticket_id}/comentarios/",
        f"{BASE_URL}/tickets/comentarios/"
    ]
    
    payload = {
        "ticket": ticket_id,
        "comentario": "Test comment from debug script",
        "respuesta": "Test comment from debug script"
    }
    
    for url in endpoints:
        print(f"Trying POST {url} ...")
        try:
            res = requests.post(url, headers=HEADERS, json=payload)
            print(f"Status: {res.status_code}")
            if res.status_code in [200, 201]:
                print(f"SUCCESS: Comment added via {url}")
                return
            else:
                print(f"Response: {res.text[:100]}")
        except Exception as e:
            print(f"Exception: {e}")

def test_edit_ticket_formats(ticket):
    ticket_id = ticket['id_ticket']
    print(f"\n--- Testing Edit Ticket Logic for Ticket {ticket_id} ---")
    
    # Pruebas de formato de fecha
    current_desc = ticket.get('descripcion', '')
    
    # Caso 1: JSON con fecha ISO (Simulando lo que hice)
    payload_iso = {
        "asunto": ticket.get('asunto') or "Internet Lento",
        "prioridad": 2,
        "estado": 1,
        "tecnico": ticket.get('tecnico_id') or (ticket.get('tecnico') if isinstance(ticket.get('tecnico'), dict) else ticket.get('tecnico')),
        "descripcion": current_desc + " [TEST JSON ISO]",
        "fecha_inicio": datetime.now().strftime("%Y-%m-%dT%H:%M"), # ISO Format
        "fecha_final": datetime.now().strftime("%Y-%m-%dT%H:%M")
    }
    
    print("Attempt 1: PUT JSON with ISO Date...")
    res = requests.put(f"{BASE_URL}/tickets/{ticket_id}/", headers=HEADERS, json=payload_iso)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:200]}")

    # Caso 2: JSON con fecha DD/MM/YYYY HH:mm (Documentación)
    payload_doc = payload_iso.copy()
    payload_doc['descripcion'] = current_desc + " [TEST JSON DOC DATE]"
    payload_doc['fecha_inicio'] = datetime.now().strftime("%d/%m/%Y %H:%M")
    payload_doc['fecha_final'] = datetime.now().strftime("%d/%m/%Y %H:%M")
    
    print("\nAttempt 2: PUT JSON with DD/MM/YYYY Date...")
    res = requests.put(f"{BASE_URL}/tickets/{ticket_id}/", headers=HEADERS, json=payload_doc)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:200]}")
    
    # Caso 3: Multipart with DD/MM/YYYY
    print("\nAttempt 3: PUT Multipart with DD/MM/YYYY Date...")
    # Requests handles multipart if data is passed instead of json
    # Convert ints to strings for multipart
    payload_multipart = {k: str(v) for k, v in payload_doc.items()} 
    
    headers_multipart = {
         "Authorization": f"Api-Key {API_KEY}",
         # Requests adds Content-Type: multipart/form-data; boundary=... automatically
    }
    
    res = requests.put(f"{BASE_URL}/tickets/{ticket_id}/", headers=headers_multipart, data=payload_multipart)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text[:200]}")

ticket = get_recent_ticket()
if ticket:
    ticket_id = ticket.get('id_ticket') or ticket.get('id')
    print(f"Testing with ticket ID: {ticket_id}")
    
    # 1. Test Comments
    test_comment_endpoints(ticket_id)
    
    # 2. Test Edit Formats
    test_edit_ticket_formats(ticket)
else:
    print("Could not find a ticket to test.")
