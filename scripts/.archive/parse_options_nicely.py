import codecs
import json

def parse_options():
    try:
        with codecs.open('ticket_options.json', 'r', 'utf-16') as f:
            content = f.read()
        
        # Clean up common shell artifacts if any
        if 'Status: 200' in content:
            content = content.split('Status: 200')[1].strip()
            
        data = json.loads(content)
        actions = data.get('actions', {})
        post_actions = actions.get('POST', {})
        put_actions = actions.get('PUT', {})
        
        print("--- POST FIELDS ---")
        for k, v in post_actions.items():
            print(f"{k}: {v.get('type')} ({'READ ONLY' if v.get('read_only') else 'WRITABLE'})")
            
        print("\n--- PUT/PATCH FIELDS ---")
        for k, v in put_actions.items():
            print(f"{k}: {v.get('type')} ({'READ ONLY' if v.get('read_only') else 'WRITABLE'})")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    parse_options()
