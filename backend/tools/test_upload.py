import requests
import time

url = 'http://127.0.0.1:8000/upload-face-image'
image_path = '../public/images/sample-face-photo.jpg'
files = {'file': ('sample-face-photo.jpg', open(image_path, 'rb'), 'image/jpeg')}
data = {'userId': 'load_test_user', 'name': 'Load Test', 'matric': 'LT123', 'department': 'CS'}

# retry until server is up
for i in range(10):
    try:
        r = requests.post(url, data=data, files=files, timeout=10)
        print('Status:', r.status_code)
        try:
            print(r.json())
        except Exception:
            print(r.text)
        break
    except Exception as e:
        print('Attempt', i+1, 'failed:', e)
        time.sleep(1)
