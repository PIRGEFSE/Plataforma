import urllib.request
import json

try:
    with urllib.request.urlopen('http://localhost:8000/sostenibilidad/metricas?sost_id=1') as response:
        html = response.read()
        print(json.loads(html))
except Exception as e:
    print(e)
