import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}

def get_response_count():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return len(res.json().get('respuestas', []))
    return -1

def test_variation(name, payload):
    print(f"\n--- Testing Variation: {name} ---")
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.patch(url, headers=HEADERS, json=payload)
    print(f"Status: {res.status_code}")
    if res.status_code < 300:
        count = get_response_count()
        print(f"Número de respuestas: {count}")
        return count
    else:
        print(f"Error: {res.text[:200]}")
        return -1

if __name__ == "__main__":
    initial = get_response_count()
    print(f"Inicial: {initial}")

    # Variación 1: respuestas como string (a veces las APIs permiten esto)
    test_variation("respuestas as string", {"respuestas": "Prueba Variation String"})

    # Variación 2: respuestas como array de strings
    test_variation("respuestas as string array", {"respuestas": ["Prueba Variation String Array"]})

    # Variación 3: La que el usuario sugirió (anidada) pero con campo 'respuesta'
    test_variation("respuestas as object array", {"respuestas": [{"respuesta": "Prueba Variation Object Array"}]})

    # Variación 4: Usando 'respuesta' singular en la raíz (ya probada con status 200 pero sin éxito de creación)
    test_variation("respuesta singular root", {"respuesta": "Prueba Variation Singular Root"})
