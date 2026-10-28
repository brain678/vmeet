"""
Simple concurrent load tester for /verify-face-no-session
Usage:
    python load_test_verify.py --url http://127.0.0.1:8000/verify-face-no-session --userId test_user --image ../public/test_face.jpg --concurrency 25 --requests 50

The script uploads the same image multiple times concurrently and reports timings and success rate.
"""
import argparse
import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed


def do_request(url, userId, image_path, timeout=10):
    with open(image_path, "rb") as f:
        files = {"file": ("face.jpg", f, "image/jpeg")}
        data = {"userId": userId}
        start = time.perf_counter()
        try:
            r = requests.post(url, data=data, files=files, timeout=timeout)
            elapsed = (time.perf_counter() - start) * 1000.0
            return r.status_code, r.text, elapsed
        except Exception as e:
            elapsed = (time.perf_counter() - start) * 1000.0
            return None, str(e), elapsed


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True)
    p.add_argument("--userId", required=True)
    p.add_argument("--image", required=True)
    p.add_argument("--concurrency", type=int, default=20)
    p.add_argument("--requests", type=int, default=50)
    args = p.parse_args()

    url = args.url
    userId = args.userId
    image = args.image
    concurrency = args.concurrency
    total = args.requests

    print(f"Starting load test: {total} requests, concurrency={concurrency}")

    results = []
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [ex.submit(do_request, url, userId, image) for _ in range(total)]
        for future in as_completed(futures):
            results.append(future.result())

    success = sum(1 for r in results if r[0] == 200)
    failures = len(results) - success
    times = [r[2] for r in results if r[2] is not None]
    if times:
        print(f"Completed: success={success}, failures={failures}")
        print(f"Min={min(times):.1f}ms, Max={max(times):.1f}ms, Avg={sum(times)/len(times):.1f}ms")
    else:
        print("No timing data collected")

if __name__ == '__main__':
    main()
