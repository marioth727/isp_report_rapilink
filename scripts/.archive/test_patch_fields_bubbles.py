"""
PROBAR: ¿Se puede crear una burbuja nueva usando PATCH al ticket?
Probaremos varios nombres de campos sospechosos.
"""
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='.env')
API_KEY = os.getenv('VITE_WISPHUB_API_KEY')
TICKET_ID = '66702'
BASE_URL = "https://api.wisphub.io/api"
url = f"{BASE_URL}/tickets/{TICKET_ID}/"

headers = {
    "Authorization": f"Api-Key {API_KEY}",
    "Content-Type": "application/json"
}

def get_ticket_info():
    res = requests.get(url, headers={"Authorization": f"Api-Key {API_KEY}"})
    data = res.json()
    return len(data.get('respuestas', [])), data.get('descripcion', '')

print("="*60)
print("TEST: Crear burbuja nueva vía PATCH al ticket")
print("="*60)

# Campos a probar que podrían gatillar una respuesta nueva
pruebas = [
    {"respuesta": "Burbuja de prueba: campo 'respuesta'"},
    {"comentario": "Burbuja de prueba: campo 'comentario'"},
    {"nueva_respuesta": "Burbuja de prueba: campo 'nueva_respuesta'"},
    {"respuestas": [{"respuesta": "Burbuja de prueba: array en 'respuestas'"}]}
]

for payload in pruebas:
    campo = list(payload.keys())[0]
    print(f"\n[PROBANDO CAMPO: '{campo}']")
    
    antes_num, _ = get_ticket_info()
    
    res = requests.patch(url, headers=headers, json=payload)
    print(f"  Status: {res.status_code}")
    
    if res.ok:
        despues_num, _ = get_ticket_info()
        if despues_num > antes_num:
            print(f"  ✅ ¡ÉXITO! Se creó una burbuja nueva ({antes_num} -> {despues_num})")
            break
        else:
            print(f"  ❌ No se creó burbuja. El contador sigue en {despues_num}")
    else:
        print(f"  ❌ Error: {res.text[:200]}")

print("\n" + "="*60)
print("FIN DE PRUEBAS")
print("="*60)
