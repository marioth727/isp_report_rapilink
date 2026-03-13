import json

with open('ticket_options.json', 'rb') as f:
    data = json.loads(f.read().decode('utf-16-le'))
    
    def search(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if "respuesta" in k.lower():
                    print(f"Found '{k}' at {path}.{k}: {v}")
                search(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                search(v, f"{path}[{i}]")

    search(data)
