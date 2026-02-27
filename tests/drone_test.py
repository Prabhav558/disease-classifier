"""
drone_test.py — Simulates drone flights over crop zones for demo / review sessions.

Sends real crop images from data/Crop___Disease/ to POST /api/drone/upload,
triggering the full ML pipeline (multimodal inference + alert engine).

Usage:
    # Single flight — one zone, one image, interactive prompts:
    python tests/drone_test.py

    # Full sweep — fly over all zones with mixed healthy/disease images:
    python tests/drone_test.py --sweep

    # Target a specific zone with a specific scenario:
    python tests/drone_test.py --zone 30 --scenario disease
"""

import sys
import io
import os
import argparse
import random
import glob
import requests

# Force UTF-8 output on Windows terminals
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL   = "http://localhost:8000"
DATA_DIR   = os.path.join(os.path.dirname(__file__), "..", "data", "Crop___Disease")
# ─────────────────────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ── Image catalogue ───────────────────────────────────────────────────────────

def build_catalogue() -> dict:
    """Return {'healthy': [...paths...], 'disease': [...paths...]}"""
    catalogue = {"healthy": [], "disease": []}
    for path in glob.glob(os.path.join(DATA_DIR, "**", "*.jpg"), recursive=True) + \
                glob.glob(os.path.join(DATA_DIR, "**", "*.JPG"), recursive=True):
        folder = os.path.basename(os.path.dirname(path)).lower()
        if "healthy" in folder:
            catalogue["healthy"].append(path)
        else:
            catalogue["disease"].append(path)
    return catalogue


def build_plant_catalogue() -> dict:
    """Return {plant_type: {'healthy': [...], 'disease': [...]}} grouped by plant."""
    catalogue = {}
    for path in glob.glob(os.path.join(DATA_DIR, "**", "*.jpg"), recursive=True) + \
                glob.glob(os.path.join(DATA_DIR, "**", "*.JPG"), recursive=True):
        # Folder structure: Crop___Disease/<Plant>/<Plant>___<Condition>/<image>
        condition_folder = os.path.basename(os.path.dirname(path))      # e.g. Corn___Common_Rust
        plant_folder     = os.path.basename(os.path.dirname(os.path.dirname(path)))  # e.g. Corn

        if plant_folder not in catalogue:
            catalogue[plant_folder] = {"healthy": [], "disease": []}

        if "healthy" in condition_folder.lower():
            catalogue[plant_folder]["healthy"].append(path)
        else:
            catalogue[plant_folder]["disease"].append(path)
    return catalogue


def pick_image(catalogue: dict, scenario: str) -> str:
    """Pick a random image matching the scenario ('healthy' or 'disease')."""
    key = "healthy" if scenario == "healthy" else "disease"
    pool = catalogue.get(key, [])
    if not pool:
        raise FileNotFoundError(f"No images found for scenario '{scenario}' in {DATA_DIR}")
    return random.choice(pool)


def pick_n_images(pool: list, n: int) -> list:
    """Pick n unique images from pool (or all if pool is smaller)."""
    if len(pool) <= n:
        return list(pool)
    return random.sample(pool, n)


# ── NPK values to accompany each image ───────────────────────────────────────
DRONE_READINGS = {
    "healthy":  {"n": 45, "p": 30, "k": 40, "soil_moisture": 58},
    "disease":  {"n": 22, "p": 16, "k": 21, "soil_moisture": 38},
    "nutrient": {"n": 18, "p": 12, "k": 17, "soil_moisture": 45},
    "water":    {"n": 40, "p": 28, "k": 35, "soil_moisture": 12},
}

CONFIDENCE_COLOUR = {
    "healthy":        GREEN,
    "disease_stress": RED,
    "nutrient_stress": YELLOW,
    "water_stress":   YELLOW,
}

# ── HTTP call ─────────────────────────────────────────────────────────────────

def upload_drone(zone_id: int, image_path: str, scenario: str) -> dict | None:
    values = DRONE_READINGS.get(scenario, DRONE_READINGS["healthy"])
    jitter = lambda v: round(max(0, v + random.uniform(-2, 2)), 2)

    try:
        with open(image_path, "rb") as img_file:
            resp = requests.post(
                f"{BASE_URL}/api/drone/upload",
                data={
                    "zone_id":      zone_id,
                    "n":            jitter(values["n"]),
                    "p":            jitter(values["p"]),
                    "k":            jitter(values["k"]),
                    "soil_moisture": jitter(values["soil_moisture"]),
                },
                files={"image": (os.path.basename(image_path), img_file, "image/jpeg")},
                timeout=60,  # ML inference can take a few seconds
            )
        if resp.status_code == 200:
            return resp.json()
        else:
            print(f"  {RED}HTTP {resp.status_code}{RESET}  {resp.text[:120]}")
            return None
    except Exception as e:
        print(f"  {RED}ERROR{RESET}  {e}")
        return None


def print_result(zone_id: int, image_path: str, result: dict):
    analysis   = result.get("analysis", {})
    prediction = analysis.get("prediction", "unknown")
    confidence = analysis.get("confidence", 0) * 100
    colour     = CONFIDENCE_COLOUR.get(prediction, RESET)
    img_name   = os.path.basename(image_path)
    folder     = os.path.basename(os.path.dirname(image_path))

    print(f"  Zone {zone_id:<4}  {CYAN}{folder}{RESET}")
    print(f"    Image      : {img_name}")
    print(f"    Prediction : {colour}{BOLD}{prediction}{RESET}")
    print(f"    Confidence : {colour}{confidence:.1f}%{RESET}")

    # Show all class probabilities
    probs = analysis.get("all_probs", {})
    if probs:
        print(f"    All probs  :")
        for label, prob in sorted(probs.items(), key=lambda x: -x[1]):
            bar = "█" * int(prob * 20)
            print(f"      {label:<18} {prob*100:5.1f}%  {bar}")
    print()


# ── Modes ─────────────────────────────────────────────────────────────────────

def fetch_sensors() -> list[dict]:
    try:
        r = requests.get(f"{BASE_URL}/api/sensors", timeout=8)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"{RED}Cannot reach backend: {e}{RESET}")
        sys.exit(1)


def run_sweep(catalogue: dict, sensors: list[dict]):
    """Fly over every zone, alternating healthy/disease for visual contrast."""
    print(f"\n{BOLD}Drone sweep — {len(sensors)} zones{RESET}\n")

    scenario_cycle = ["healthy", "disease", "healthy", "nutrient", "water", "disease"]

    for i, sensor in enumerate(sensors):
        scenario   = scenario_cycle[i % len(scenario_cycle)]
        zone_id    = sensor["id"]
        image_path = pick_image(catalogue, scenario)
        img_scenario = "healthy" if scenario == "healthy" else "disease"

        print(f"  Flying zone {zone_id} (zone {sensor['zone_index']+1})  scenario={scenario} …", end=" ", flush=True)
        result = upload_drone(zone_id, image_path, img_scenario)

        if result:
            analysis   = result.get("analysis", {})
            prediction = analysis.get("prediction", "?")
            confidence = analysis.get("confidence", 0) * 100
            colour     = CONFIDENCE_COLOUR.get(prediction, RESET)
            print(f"{colour}{prediction} ({confidence:.0f}%){RESET}")
        else:
            print(f"{RED}FAILED{RESET}")

    print(f"\n{GREEN}{BOLD}Sweep complete — check the dashboard for updated zone colours.{RESET}\n")


def run_single(catalogue: dict, sensors: list[dict], zone_id: int | None, scenario: str):
    """Upload one image to one zone and print the full result."""
    if zone_id is None:
        # Pick the first sensor
        zone_id = sensors[0]["id"]

    # Confirm zone exists
    sensor = next((s for s in sensors if s["id"] == zone_id), None)
    if not sensor:
        print(f"{RED}Zone {zone_id} not found. Available: {[s['id'] for s in sensors]}{RESET}")
        sys.exit(1)

    img_scenario = "healthy" if scenario == "healthy" else "disease"
    image_path   = pick_image(catalogue, img_scenario)

    print(f"\n{BOLD}Drone upload{RESET}  zone={zone_id}  scenario={scenario}")
    print(f"  Image: {os.path.basename(image_path)}")
    print(f"  Sending to {BASE_URL}/api/drone/upload …\n")

    result = upload_drone(zone_id, image_path, scenario)
    if result:
        print_result(zone_id, image_path, result)
        print(f"{GREEN}Upload successful.{RESET}  Refresh the dashboard to see the updated zone.\n")


def run_multi(plant_type: str, count: int, scenario: str, sensors: list[dict]):
    """Upload N different images for a specific plant type across zones."""
    plant_catalogue = build_plant_catalogue()

    # Find matching plant (case-insensitive)
    matched_plant = None
    for p in plant_catalogue:
        if p.lower() == plant_type.lower():
            matched_plant = p
            break

    if not matched_plant:
        print(f"{RED}Plant type '{plant_type}' not found.{RESET}")
        print(f"Available: {', '.join(sorted(plant_catalogue.keys()))}")
        sys.exit(1)

    plant_images = plant_catalogue[matched_plant]
    img_key = "healthy" if scenario == "healthy" else "disease"
    pool = plant_images.get(img_key, [])

    if not pool:
        print(f"{RED}No {img_key} images found for {matched_plant}.{RESET}")
        sys.exit(1)

    images = pick_n_images(pool, count)
    actual_count = len(images)

    print(f"\n{BOLD}Multi-image drone test{RESET}")
    print(f"  Plant    : {CYAN}{matched_plant}{RESET}")
    print(f"  Scenario : {scenario}")
    print(f"  Images   : {actual_count} (requested {count})")
    print(f"  Zones    : cycling across {len(sensors)} sensor(s)\n")
    print(f"{'─'*62}")

    success = 0
    for i, image_path in enumerate(images):
        sensor  = sensors[i % len(sensors)]
        zone_id = sensor["id"]
        img_name = os.path.basename(image_path)
        folder   = os.path.basename(os.path.dirname(image_path))

        print(f"\n  [{i+1}/{actual_count}]  {CYAN}{folder}{RESET} / {img_name}")
        print(f"    → zone {zone_id} (zone {sensor['zone_index']+1})")

        result = upload_drone(zone_id, image_path, scenario)
        if result:
            analysis   = result.get("analysis", {})
            prediction = analysis.get("prediction", "?")
            confidence = analysis.get("confidence", 0) * 100
            colour     = CONFIDENCE_COLOUR.get(prediction, RESET)
            print(f"    Prediction : {colour}{BOLD}{prediction}{RESET}  ({colour}{confidence:.1f}%{RESET})")
            success += 1
        else:
            print(f"    {RED}FAILED{RESET}")

    print(f"\n{'─'*62}")
    print(f"  {GREEN}{BOLD}Done — {success}/{actual_count} uploads succeeded.{RESET}")
    print(f"  Refresh the dashboard to see updated zones.\n")


def select_plant_interactive(plant_catalogue: dict) -> str:
    """Interactive menu to pick a plant type."""
    plants = sorted(plant_catalogue.keys())
    print(f"\n{BOLD}Select a plant type:{RESET}\n")
    for i, plant in enumerate(plants, 1):
        h = len(plant_catalogue[plant]["healthy"])
        d = len(plant_catalogue[plant]["disease"])
        print(f"  {CYAN}{i}{RESET}. {plant:<10}  ({h} healthy, {d} disease)")
    print()

    while True:
        try:
            choice = input(f"  Enter number (1-{len(plants)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(plants):
                return plants[idx]
        except (ValueError, EOFError):
            pass
        print(f"  {RED}Invalid choice, try again.{RESET}")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Drone flight simulator for demo")
    parser.add_argument("--sweep",    action="store_true", help="Fly over all zones")
    parser.add_argument("--zone",     type=int, default=None, help="Target zone (sensor ID)")
    parser.add_argument("--scenario", default="disease",
                        choices=["healthy", "disease", "nutrient", "water"],
                        help="Which NPK profile + image set to use")
    parser.add_argument("--plant",    type=str, default=None,
                        help="Plant type (Corn, Potato, Rice, Wheat)")
    parser.add_argument("--count",    type=int, default=10,
                        help="Number of images to upload (default: 10)")
    args = parser.parse_args()

    catalogue = build_catalogue()
    total = len(catalogue["healthy"]) + len(catalogue["disease"])
    print(f"\n{BOLD}Drone Test — Image catalogue:{RESET}  "
          f"{len(catalogue['healthy'])} healthy  |  {len(catalogue['disease'])} disease  ({total} total)")

    sensors = fetch_sensors()
    print(f"Sensors found: {len(sensors)}")

    if args.sweep:
        run_sweep(catalogue, sensors)
    elif args.plant:
        # Multi-image mode with specified plant
        run_multi(args.plant, args.count, args.scenario, sensors)
    elif args.zone:
        run_single(catalogue, sensors, args.zone, args.scenario)
    else:
        # Interactive: ask user to pick a plant, then upload N images
        plant_catalogue = build_plant_catalogue()
        plant = select_plant_interactive(plant_catalogue)
        print(f"\n  Selected: {GREEN}{BOLD}{plant}{RESET}")
        run_multi(plant, args.count, args.scenario, sensors)


if __name__ == "__main__":
    main()
