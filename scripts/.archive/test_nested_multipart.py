import os
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"

HEADERS = {
    "Authorization": f"Api-Key {API_KEY}",
    "Accept": "application/json"
}

def get_response_count():
    url = f"{BASE_URL}/tickets/{TICKET_ID}/"
    res = requests.get(url, headers=HEADERS)
    if res.status_code == 200:
        return len(res.json().get('respuestas', []))
    return -1

def run_test():
    initial_count = get_response_count()
    print(f"Número inicial de respuestas: {initial_count}")

    # En el web es multipart/form-data. Vamos a probar eso en los endpoints anidados.
    files = {
        'respuesta': (None, 'Prueba Multipart Anidada'),
        'comentario': (None, 'Prueba Multipart Anidada')
    }

    endpoints = [
        f"{BASE_URL}/tickets/{TICKET_ID}/respuestas/",
        f"{BASE_URL}/tickets/{TICKET_ID}/comentarios/",
        f"{BASE_URL}/tickets/respuestas/",
        f"{BASE_URL}/tickets/comentarios/"
    ]

    for url in endpoints:
        print(f"Testing POST {url} (Multipart)")
        try:
            res = requests.post(url, headers=HEADERS, files=files, timeout=5)
            print(f"  Status: {res.status_code}")
            if res.status_code < 300:
                print(f"  ✅ SUCCESS on {url}")
                new_count = get_response_count()
                print(f"  Número final: {new_count}")
                if new_count > initial_count:
                    print("  --- ¡BINGO! ---")
                    return
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    run_test()
