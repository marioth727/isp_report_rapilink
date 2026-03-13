with open('ticket_options.json', 'rb') as f:
    text = f.read().decode('utf-16-le')
    lines = text.split('\n')
    for i in range(10, 60):
        if i < len(lines):
            print(f"{i+1}: {lines[i].strip()}")
