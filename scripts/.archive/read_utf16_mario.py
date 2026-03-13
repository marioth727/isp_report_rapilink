import json
with open('mario_ticket_full_2.json', 'r', encoding='utf-16-le') as f:
    data = json.load(f)
    print(json.dumps(data, indent=2)[:2000])
