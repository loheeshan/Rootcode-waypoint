"""Check that each demo identity can log in through the running API and read /me.

Prompts for the operator's demo password; never prints passwords or tokens.
"""

import argparse
import json
import urllib.error
import urllib.request
from collections.abc import Sequence
from getpass import getpass
from typing import Any

EXPECTED = {
    "store@waypoint.demo": "STORE_MANAGER",
    "dispatcher@waypoint.demo": "DISPATCHER",
    "loader@waypoint.demo": "LOADER",
    "driver@waypoint.demo": "DRIVER",
}


def _call(url: str, body: dict[str, Any] | None = None, token: str | None = None) -> Any:
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310 - operator URL
        return json.loads(response.read())


def check(api_url: str, password: str) -> list[str]:
    base = api_url.rstrip("/")
    lines = []
    for email, role in EXPECTED.items():
        try:
            login = _call(f"{base}/auth/login", {"email": email, "password": password})
            me = _call(f"{base}/me", token=login["access_token"])
        except urllib.error.HTTPError as error:
            lines.append(f"FAIL {email}: HTTP {error.code}")
            continue
        except urllib.error.URLError as error:
            lines.append(f"FAIL {email}: API unreachable ({error.reason})")
            continue
        except (OSError, ValueError, KeyError, TypeError) as error:
            lines.append(f"FAIL {email}: unexpected response ({type(error).__name__})")
            continue
        ok = role in me.get("roles", []) and bool(me.get("outlet_ids") or me.get("depot_ids"))
        lines.append(
            f"{'PASS' if ok else 'FAIL'} {email}: roles={me.get('roles')} "
            f"outlets={len(me.get('outlet_ids', []))} depots={len(me.get('depot_ids', []))}"
        )
    return lines


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify demo logins against a running API")
    parser.add_argument(
        "--api-url", default="http://localhost:8000/api/v1", help="API base including /api/v1"
    )
    args = parser.parse_args(argv)
    lines = check(args.api_url, getpass("Demo account password: "))
    print("\n".join(lines))
    return 0 if all(line.startswith("PASS") for line in lines) else 1


if __name__ == "__main__":
    raise SystemExit(main())
