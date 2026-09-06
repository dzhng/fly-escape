#!/bin/bash
# Fly Maze - MaleCNS LIF Chemotaxis Simulation
#
# Run baseline (no odor) and fruit-odor chemotaxis comparison.
#
# Usage:
#   ./run.sh                    # Run both conditions
#   ./run.sh --baseline-only    # Run only baseline
#   ./run.sh --fruit-only       # Run only fruit condition
#   ./run.sh --download         # Download data only

set -e

cd "$(dirname "$0")"

if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found"
    exit 1
fi

if ! python3 -c "import pyarrow" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

python3 run.py "$@"
