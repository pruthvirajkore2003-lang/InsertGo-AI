import httpx
url = "http://localhost:3000/api/desktop/token"
success = 0
for i in range(25):
    resp = httpx.post(url, json={})
    if resp.status_code == 429:
        print(f"Hit 429 after {i} requests")
        break

for i in range(5):
    resp = httpx.post(url, json={}, headers={"X-Forwarded-For": f"10.0.{i}.1"})
    if resp.status_code != 429:
        success += 1

print(f"Spoofed XFF successes: {success}")
