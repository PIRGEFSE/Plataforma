import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    with urllib.request.urlopen('http://localhost:8000/sostenibilidad/metricas?sost_id=69110400', context=ctx) as response:
        html = response.read()
        print(json.loads(html))
except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()
