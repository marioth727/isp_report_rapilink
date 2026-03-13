import json
import codecs

try:
    with codecs.open('ticket_66702_v2.json', 'r', 'utf-16') as f:
        data = f.read()
except:
    with open('ticket_66702_v2.json', 'r', encoding='utf-8') as f:
        data = f.read()

# Try to parse as JSON to ensure it's valid
try:
    parsed = json.loads(data)
    print(json.dumps(parsed, indent=2))
except Exception as e:
    print(f"Error parsing JSON: {e}")
    print(data[:1000])
