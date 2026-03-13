import json

with open('ticket_options.json', 'rb') as f:
    raw = f.read().decode('utf-16-le')
    data = json.loads(raw)

    def find_interesting(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                k_lower = k.lower()
                if "action" in k_lower or "post" in k_lower or "put" in k_lower:
                    print(f"Key Found: {path}.{k} = {v}")
                
                # Also check values for common DRF action patterns
                if isinstance(v, str):
                    v_lower = v.lower()
                    if "responder" in v_lower or "comentar" in v_lower:
                        print(f"Value Found: {path}.{k} = {v}")
                
                find_interesting(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                find_interesting(v, f"{path}[{i}]")

    print("--- Searching for interesting keys in OPTIONS ---")
    find_interesting(data)
