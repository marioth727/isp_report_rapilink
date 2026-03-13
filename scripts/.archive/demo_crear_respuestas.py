"""
CÓDIGO PARA CREAR RESPUESTAS/BURBUJAS EN WISPHUB
Este es el equivalente en Python del método addTicketComment() de TypeScript
"""
import requests

# ====== CONFIGURACIÓN ======
API_KEY = "TU_API_KEY_AQUI"
TICKET_ID = "66702"
BASE_URL = "https://api.wisphub.io/api"

# ====== MENSAJE Y ARCHIVO ======
comentario = "Ticket finalizado. Equipo instalado correctamente."
# Archivo PNG de 10KB (ejemplo)
png_bytes = b'\x89PNG\r\n\x1a\n...(datos de imagen)...\xaeB`\x82'
nombre_archivo = "evidencia.png"

# ====== ENDPOINTS QUE SE PRUEBAN (en orden) ======
# La app prueba múltiples variantes porque la API de WispHub 
# tiene diferentes rutas según la versión
endpoints_a_probar = [
    f"{BASE_URL}/tickets/{TICKET_ID}/comentarios/",  # Variante 1
    f"{BASE_URL}/tickets/comentarios/",              # Variante 2
    f"{BASE_URL}/tickets/{TICKET_ID}/respuestas/",   # Variante 3
    f"{BASE_URL}/tickets/respuestas/"                # Variante 4
]

# ====== ENVIAR CON ARCHIVO (multipart/form-data) ======
for url in endpoints_a_probar:
    print(f"\n[TEST] Probando: {url}")
    
    # FormData con archivo
    files = {
        'archivo': (nombre_archivo, png_bytes, 'image/png')
    }
    
    data = {
        'ticket': str(TICKET_ID),
        'comentario': comentario,
        'respuesta': comentario  # Campo backup (algunas versiones usan este)
    }
    
    headers = {
        "Authorization": f"Api-Key {API_KEY}"
        # NO incluir Content-Type, requests lo maneja automáticamente
    }
    
    response = requests.post(url, headers=headers, data=data, files=files)
    
    print(f"  Status: {response.status_code}")
    
    if response.ok:
        print(f"  ✓ SUCCESS - Respuesta creada en: {url}")
        print(f"  Response: {response.text[:200]}")
        break  # Salir al primer éxito
    else:
        print(f"  ✗ Falló - Intentando siguiente endpoint...")
        print(f"  Error: {response.text[:100]}")

# ====== ENVIAR SIN ARCHIVO (application/json) ======
# Si no hay archivo, se puede usar JSON:
"""
headers_json = {
    "Authorization": f"Api-Key {API_KEY}",
    "Content-Type": "application/json"
}

payload_json = {
    "ticket": str(TICKET_ID),
    "comentario": comentario,
    "respuesta": comentario
}

response = requests.post(url, headers=headers_json, json=payload_json)
"""

# ====== NOTAS IMPORTANTES ======
print("\n" + "="*60)
print("NOTAS PARA INGENIEROS DE WISPHUB:")
print("="*60)
print("1. Campo para archivo: 'archivo' (no 'archivo_ticket')")
print("2. Se envía como multipart/form-data cuando hay archivo")
print("3. Se envía como application/json cuando NO hay archivo")
print("4. La app prueba 4 endpoints diferentes para compatibilidad")
print("5. Campos enviados: ticket, comentario, respuesta, archivo")
print("="*60)
print("\nPREGUNTAS:")
print("- ¿Cuál es el endpoint OFICIAL para crear respuestas?")
print("- ¿Se debe usar 'comentario' o 'respuesta' como nombre de campo?")
print("- ¿Hay diferencia entre /comentarios/ y /respuestas/?")
print("="*60)
