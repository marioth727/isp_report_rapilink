import json

with open('ticket_options.json', 'rb') as f:
    content = f.read().decode('utf-16-le')
    print(content)
