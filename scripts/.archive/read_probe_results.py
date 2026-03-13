import os

def read_results():
    path = 'd:/desarrollo antgra/isp-reports-app/probe_results.txt'
    if not os.path.exists(path):
        print("File not found.")
        return
    
    # Try different encodings
    for enc in ['utf-8', 'utf-16', 'utf-16-le', 'cp1252']:
        try:
            with open(path, 'r', encoding=enc) as f:
                content = f.read()
                if content:
                    print(f"--- Content (Encoding: {enc}) ---")
                    print(content)
                    return
        except:
            continue
    print("Could not read file with any tested encoding.")

if __name__ == "__main__":
    read_results()
