import json

with open('scripts/api_test_result.json', 'rb') as f:
    content = f.read().decode('utf-16-le')
    print(content[:2000])
