"""Run with: uv run --project apps/api python scripts/seed.py --demo."""

import os
import sys
from pathlib import Path


def main() -> int:
    api_root = Path(__file__).resolve().parents[1] / "apps" / "api"
    sys.path.insert(0, str(api_root))
    # Settings reads .env relative to cwd; always select the local API environment.
    os.chdir(api_root)
    from app.auth.seed import main as seed_main

    return seed_main()


if __name__ == "__main__":
    raise SystemExit(main())
