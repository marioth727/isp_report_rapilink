with open('ticket_options.json', 'rb') as f:
    text = f.read().decode('utf-16-le')
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if 'respuesta' in line.lower():
            print(f"Line {i}: {line.strip()}")
