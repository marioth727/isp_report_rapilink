import json
with open('ticket_options.json', 'r', encoding='utf-16-le') as f:
    data = json.load(f)
    # Print the 'actions' section to explain the POST method
    print(json.dumps(data.get('actions', {}), indent=2))
