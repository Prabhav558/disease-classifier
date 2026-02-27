"""
simulate_live.py — Realistic IoT node simulation for demo / review sessions.

Usage:
    python tests/simulate_live.py

Controls:
    [Enter]  advance to next scenario immediately
    Ctrl+C   stop

How it works:
    1. Fetches all sensor IDs from the active farm config via GET /api/sensors
    2. Every INTERVAL seconds, POSTs a reading for every sensor
    3. Auto-cycles through scenarios every CYCLE_EVERY rounds
    4. Prints a live table so reviewers can see what's being sent
"""

import sys
import io
import time
import threading
import requests

# Force UTF-8 output on Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL     = "http://localhost:8000"   # FastAPI backend
INTERVAL     = 15                        # seconds between rounds
CYCLE_EVERY  = 3                         # auto-advance scenario every N rounds
# ─────────────────────────────────────────────────────────────────────────────

sys.path.insert(0, ".")
from tests.scenarios import SCENARIOS, DEMO_CYCLE, get_reading

# ── ANSI colours ─────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

SCENARIO_COLOUR = {
    "healthy":        GREEN,
    "nutrient_stress": YELLOW,
    "water_stress":   YELLOW,
    "disease_stress": YELLOW,
    "critical":       RED,
}

# ── Keyboard: press Enter to advance scenario ─────────────────────────────────
_advance = threading.Event()

def _listen():
    while True:
        try:
            input()
            _advance.set()
        except EOFError:
            break

threading.Thread(target=_listen, daemon=True).start()

# ── Helpers ───────────────────────────────────────────────────────────────────

def fetch_sensors() -> list[dict]:
    try:
        r = requests.get(f"{BASE_URL}/api/sensors", timeout=8)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"{RED}Cannot reach backend at {BASE_URL}: {e}{RESET}")
        sys.exit(1)


def post_reading(sensor_id: int, payload: dict) -> int:
    try:
        r = requests.post(
            f"{BASE_URL}/api/sensors/{sensor_id}/reading",
            json=payload,
            timeout=10,
        )
        return r.status_code
    except Exception:
        return -1


def print_header(scenario_key: str, cycle_idx: int, round_num: int):
    s = SCENARIOS[scenario_key]
    colour = SCENARIO_COLOUR.get(scenario_key, RESET)
    print(f"\n{BOLD}{'─'*62}{RESET}")
    print(f"  Round {round_num}   Scenario {cycle_idx+1}/{len(DEMO_CYCLE)}: "
          f"{colour}{BOLD}{s['label']}{RESET}")
    print(f"  {s['description']}")
    print(f"  Press {CYAN}[Enter]{RESET} to skip to next scenario")
    print(f"{'─'*62}")
    print(f"  {'Sensor':<10} {'N':>6} {'P':>6} {'K':>6} {'Moist':>7}  Status")
    print(f"  {'──────':<10} {'──':>6} {'──':>6} {'──':>6} {'──────':>7}  ──────")


def print_row(sensor_id: int, zone: int, payload: dict, code: int):
    ok   = code == 200
    stat = f"{GREEN}200 OK{RESET}" if ok else f"{RED}{code}{RESET}"
    print(f"  Sensor {sensor_id:<4} (zone {zone+1:<2})"
          f"  {payload['n']:>5}  {payload['p']:>5}  {payload['k']:>5}  "
          f"{payload['soil_moisture']:>6}%  {stat}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"\n{BOLD}Smart Crop Disease Monitoring — IoT Simulator{RESET}")
    print(f"Backend : {CYAN}{BASE_URL}{RESET}")
    print(f"Interval: {INTERVAL}s   Auto-cycle: every {CYCLE_EVERY} rounds\n")

    sensors = fetch_sensors()
    if not sensors:
        print(f"{RED}No sensors found. Create a farm config first.{RESET}")
        sys.exit(1)

    print(f"{GREEN}Found {len(sensors)} sensor node(s):{RESET}")
    for s in sensors:
        print(f"  Sensor {s['id']}  →  zone {s['zone_index']+1} "
              f"(row {s['zone_row']}, col {s['zone_col']})")

    print(f"\nStarting in 2 seconds …\n")
    time.sleep(2)

    cycle_idx = 0
    round_num = 0

    while True:
        scenario_key = DEMO_CYCLE[cycle_idx % len(DEMO_CYCLE)]

        print_header(scenario_key, cycle_idx % len(DEMO_CYCLE), round_num + 1)

        for sensor in sensors:
            payload = get_reading(scenario_key)
            code    = post_reading(sensor["id"], payload)
            print_row(sensor["id"], sensor["zone_index"], payload, code)

        round_num += 1

        # Auto-advance scenario?
        if round_num % CYCLE_EVERY == 0:
            cycle_idx += 1
            nxt = DEMO_CYCLE[cycle_idx % len(DEMO_CYCLE)]
            colour = SCENARIO_COLOUR.get(nxt, RESET)
            print(f"\n  {CYAN}Auto-advancing to:{RESET} "
                  f"{colour}{BOLD}{SCENARIOS[nxt]['label']}{RESET} "
                  f"(in {INTERVAL}s)")

        # Sleep with early-exit on Enter
        _advance.clear()
        _advance.wait(timeout=INTERVAL)
        if _advance.is_set():
            cycle_idx += 1
            print(f"  {CYAN}Manual advance →{RESET} "
                  f"{SCENARIOS[DEMO_CYCLE[cycle_idx % len(DEMO_CYCLE)]]['label']}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Simulation stopped.{RESET}")
