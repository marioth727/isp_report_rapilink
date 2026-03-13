"""
BRUTE FORCE TEST: Encontrar el endpoint de comentarios en .IO
Probando todas las combinaciones posibles en el dominio .io
"""
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

headers = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

# Lista de endpoints sospechosos en .io
endpoints = [
    f"{BASE_URL}/tickets/{TICKET_ID}/comentarios/",
    f"{BASE_URL}/tickets/{TICKET_ID}/respuestas/",
    f"{BASE_URL}/tickets/comentarios/",
    f"{BASE_URL}/tickets/respuestas/",
    f"{BASE_URL}/comentarios/",
    f"{BASE_URL}/comentarios-tickets/",
    f"{BASE_URL}/tickets-comentarios/",
    f"{BASE_URL}/tickets/{TICKET_ID}/add_comentario/",
    f"{BASE_URL}/tickets/{TICKET_ID}/add-comentario/",
    f"{BASE_URL}/tickets/{TICKET_ID}/comentar/",
]

payload = {
    "ticket": TICKET_ID,
    "comentario": "Prueba sistemática en .io",
    "respuesta": "Prueba sistemática en .io"
}

print("="*60)
print(f"BUSCANDO ENDPOINT EN .IO PARA TICKET {TICKET_ID}")
print("="*60)

for url in endpoints:
    try:
        # Probar POST con JSON
        res = requests.post(url, headers=headers, json=payload, timeout=5)
        print(f"[POST] {url.replace(BASE_URL, '')} -> Status: {res.status_code}")
        if res.status_code != 404:
            print(f"!!! POSIBLE ACIERTO !!! Response: {res.text[:100]}")
            
        # Probar PUT por si acaso (algunos APIs usan PUT para añadir a colecciones)
        # res_put = requests.put(url, headers=headers, json=payload, timeout=5)
        # print(f"  [PUT]  Status: {res_put.status_code}")
        
    except Exception as e:
        print(f"Error en {url}: {e}")

print("="*60)
