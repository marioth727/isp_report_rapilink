"""
CREAR RESPUESTAS/BURBUJAS DE TEXTO EN WISPHUB
(SIN archivo adjunto)

Este es el código para crear las burbujas verdes que aparecen en WispHub
cuando se presiona "Iniciar Ticket", "Llegada a Sitio", o "Finalizar"
"""
import requests
from datetime import datetime

# ====== CONFIGURACIÓN ======
API_KEY = "TU_API_KEY_AQUI"
TICKET_ID = "66702"
BASE_URL = "https://api.wisphub.io/api"

# ====== EJEMPLO 1: Ticket Iniciado ======
def crear_respuesta_inicio(ticket_id, nombre_tecnico):
    """
    Crea burbuja: "El ticket 66666 ha sido iniciado por JAIME MARTINEZ"
    """
    endpoints = [
        f"{BASE_URL}/tickets/{ticket_id}/comentarios/",
        f"{BASE_URL}/tickets/{ticket_id}/respuestas/",
        f"{BASE_URL}/tickets/respuestas/"
    ]
    
    mensaje = f"El ticket {ticket_id} ha sido iniciado por {nombre_tecnico}"
    
    payload = {
        "ticket": str(ticket_id),
        "comentario": mensaje,
        "respuesta": mensaje  # campo backup
    }
    
    headers = {
        "Authorization": f"Api-Key {API_KEY}",
        "Content-Type": "application/json"
    }
    
    for url in endpoints:
        print(f"[TEST] {url}")
        response = requests.post(url, headers=headers, json=payload)
        print(f"  Status: {response.status_code}")
        
        if response.ok:
            print(f"  ✓ Respuesta creada: '{mensaje}'")
            return True
        else:
            print(f"  Error: {response.text[:100]}")
    
    return False

# ====== EJEMPLO 2: Llegada a Sitio ======
def crear_respuesta_llegada(ticket_id):
    """
    Crea burbuja: "Llegada al destino del ticket 66666"
    """
    mensaje = f"Llegada al destino del ticket {ticket_id}"
    
    payload = {
        "ticket": str(ticket_id),
        "comentario": mensaje,
        "respuesta": mensaje
    }
    
    headers = {
        "Authorization": f"Api-Key {API_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{BASE_URL}/tickets/{ticket_id}/respuestas/"
    response = requests.post(url, headers=headers, json=payload)
    
    return response.ok

# ====== EJEMPLO 3: Ticket Finalizado ======
def crear_respuesta_cierre(ticket_id, nombre_tecnico, comentario_cierre=""):
    """
    Crea burbuja al finalizar ticket
    """
    fecha_hora = datetime.now().strftime("%d/%m/%Y %H:%M")
    
    if comentario_cierre:
        mensaje = f"Ticket finalizado por {nombre_tecnico} - {fecha_hora}\n{comentario_cierre}"
    else:
        mensaje = f"Ticket finalizado por {nombre_tecnico} - {fecha_hora}"
    
    payload = {
        "ticket": str(ticket_id),
        "comentario": mensaje,
        "respuesta": mensaje
    }
    
    headers = {
        "Authorization": f"Api-Key {API_KEY}",
        "Content-Type": "application/json"
    }
    
    url = f"{BASE_URL}/tickets/{ticket_id}/respuestas/"
    response = requests.post(url, headers=headers, json=payload)
    
    return response.ok

# ====== EJECUTAR PRUEBAS ======
if __name__ == "__main__":
    print("="*60)
    print("PRUEBA: Crear respuestas de texto en WispHub")
    print("="*60)
    
    # Test 1: Inicio
    print("\n[1] Creando respuesta de INICIO...")
    crear_respuesta_inicio("66702", "JAIME MARTINEZ")
    
    # Test 2: Llegada
    print("\n[2] Creando respuesta de LLEGADA...")
    crear_respuesta_llegada("66702")
    
    # Test 3: Cierre
    print("\n[3] Creando respuesta de CIERRE...")
    crear_respuesta_cierre("66702", "MARIO VASQUEZ", "Equipo instalado correctamente")
    
    print("\n" + "="*60)
    print("ESTRUCTURA DEL REQUEST:")
    print("="*60)
    print("Método: POST")
    print("URL: /api/tickets/{id}/respuestas/")
    print("Headers:")
    print("  - Authorization: Api-Key {key}")
    print("  - Content-Type: application/json")
    print("")
    print("Body (JSON):")
    print("{")
    print('  "ticket": "66702",')
    print('  "comentario": "El ticket ha sido iniciado...",')
    print('  "respuesta": "El ticket ha sido iniciado..."')
    print("}")
    print("="*60)
