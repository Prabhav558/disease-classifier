"""
quick_test.py — One-shot sanity check before the demo.

Sends a single 'healthy' reading to every sensor and confirms HTTP 200.

Usage:
    python tests/quick_test.py
"""

import sys
import io
import requests

# Force UTF-8 output on Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, ".")
from tests.scenarios import get_reading

BASE_URL = "http://localhost:8000"

GREEN = "\033[92m"
RED   = "\033[91m"
BOLD  = "\033[1m"
RESET = "\033[0m"


def main():
    print(f"\n{BOLD}Quick pre-demo check — sending healthy readings to all sensors{RESET}\n")

    # 1. Check health endpoint
    try:
        h = requests.get(f"{BASE_URL}/api/health", timeout=5)
        data = h.json()
        models = data.get("models_loaded", False)
        print(f"  Backend   {GREEN}OK{RESET}  (models_loaded={models})")
    except Exception as e:
        print(f"  Backend   {RED}UNREACHABLE{RESET} — {e}")
        print(f"\n  Start the backend first:  uvicorn main:app --reload  (from backend/)")
        sys.exit(1)

    # 2. Get sensors
    try:
        r = requests.get(f"{BASE_URL}/api/sensors", timeout=5)
        r.raise_for_status()
        sensors = r.json()
    except Exception as e:
        print(f"  Sensors   {RED}FAILED{RESET} — {e}")
        sys.exit(1)

    if not sensors:
        print(f"  {RED}No sensors found.{RESET} Create a farm config via the dashboard first.")
        sys.exit(1)

    print(f"  Sensors   {GREEN}OK{RESET}  ({len(sensors)} node(s) found)\n")

    # 3. POST healthy reading to each sensor
    all_ok = True
    payload = get_reading("healthy", jitter=0)

    for s in sensors:
        sid = s["id"]
        try:
            resp = requests.post(
                f"{BASE_URL}/api/sensors/{sid}/reading",
                json=payload,
                timeout=10,
            )
            if resp.status_code == 200:
                print(f"  {GREEN}✓{RESET}  sensor {sid}  zone {s['zone_index']+1:<3}  HTTP 200")
            else:
                print(f"  {RED}✗{RESET}  sensor {sid}  zone {s['zone_index']+1:<3}  HTTP {resp.status_code}  {resp.text[:80]}")
                all_ok = False
        except Exception as e:
            print(f"  {RED}✗{RESET}  sensor {sid}  ERROR: {e}")
            all_ok = False

    print()
    if all_ok:
        print(f"  {GREEN}{BOLD}All checks passed — ready to demo!{RESET}")
        print(f"\n  Run the live simulation:")
        print(f"    python tests/simulate_live.py\n")
    else:
        print(f"  {RED}Some sensors failed — check the backend logs.{RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
