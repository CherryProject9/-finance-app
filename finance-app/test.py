import subprocess
try:
    with open('app.js', 'r') as f:
        js = f.read()
    print("JS length:", len(js))
except Exception as e:
    print(e)
