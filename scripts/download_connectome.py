#!/usr/bin/env python3
"""
Download MaleCNS v1.0 connectome data from Google Cloud Storage via HTTPS.

Files (from https://male-cns.janelia.org/download/):
- body-annotations-male-cns-v1.0-minconf-0.5.feather (~13 MB)
- body-neurotransmitters-male-cns-v1.0.feather (~42 MB) 
- connectome-weights-male-cns-v1.0-minconf-0.5.feather (~1.1 GB)

Source: gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/
"""

import os
import sys
from pathlib import Path
import requests
from tqdm import tqdm

GCS_BASE = "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome"

FILES = [
    ("body-annotations-male-cns-v1.0-minconf-0.5.feather", 13_000_000),
    ("body-neurotransmitters-male-cns-v1.0.feather", 42_000_000),
    ("connectome-weights-male-cns-v1.0-minconf-0.5.feather", 1_100_000_000),
]

LOCAL_NAMES = {
    "body-annotations-male-cns-v1.0-minconf-0.5.feather": "body-annotations.feather",
    "body-neurotransmitters-male-cns-v1.0.feather": "body-neurotransmitters.feather",
    "connectome-weights-male-cns-v1.0-minconf-0.5.feather": "connectome-weights.feather",
}


def download_file(url: str, dest: Path, expected_size: int) -> bool:
    """Download file with progress bar."""
    if dest.exists():
        actual = dest.stat().st_size
        if actual > expected_size * 0.9:
            print(f"  [skip] {dest.name} already exists ({actual:,} bytes)")
            return True
        print(f"  [redownload] {dest.name} incomplete ({actual:,} < {expected_size:,})")

    print(f"  Downloading {dest.name}...")
    try:
        resp = requests.get(url, stream=True, timeout=60)
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", expected_size))
        
        with open(dest, "wb") as f:
            with tqdm(total=total, unit="B", unit_scale=True, desc=dest.name) as pbar:
                for chunk in resp.iter_content(chunk_size=1024 * 1024):
                    f.write(chunk)
                    pbar.update(len(chunk))
        return True
    except Exception as e:
        print(f"  [error] {e}")
        if dest.exists():
            dest.unlink()
        return False


def main():
    data_dir = Path(__file__).parent.parent / "data"
    data_dir.mkdir(exist_ok=True)
    
    print("Downloading MaleCNS v1.0 connectome data...")
    print(f"  Source: {GCS_BASE}")
    print(f"  Target: {data_dir}")
    print()
    
    success = True
    for fname, expected in FILES:
        url = f"{GCS_BASE}/{fname}"
        local_name = LOCAL_NAMES.get(fname, fname)
        dest = data_dir / local_name
        if not download_file(url, dest, expected):
            success = False
    
    print()
    if success:
        print("All files downloaded successfully!")
        for fname, _ in FILES:
            local_name = LOCAL_NAMES.get(fname, fname)
            p = data_dir / local_name
            if p.exists():
                print(f"  {local_name}: {p.stat().st_size:,} bytes")
    else:
        print("Some downloads failed. Please retry.")
        sys.exit(1)


if __name__ == "__main__":
    main()
