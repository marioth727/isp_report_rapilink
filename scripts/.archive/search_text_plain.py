import os

with open('ticket_options.json', 'rb') as f:
    text = f.read().decode('utf-16-le')
    
    interesting = ['POST', 'PUT', 'actions', 'responder', 'comentar', 'respuesta']
    
    for line_num, line in enumerate(text.split('\n')):
        found = [i for i in interesting if i.lower() in line.lower()]
        if found:
            print(f"L{line_num}: {line.strip()} (Matched: {found})")
