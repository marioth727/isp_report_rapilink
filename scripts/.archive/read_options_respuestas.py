with open('ticket_options.json', 'rb') as f:
    text = f.read().decode('utf-16-le')
    lines = text.split('\n')
    # Read around the area where we found 'respuestas'
    for i in range(290, 350):
        if i < len(lines):
            print(f"{i+1}: {lines[i].strip()}")
