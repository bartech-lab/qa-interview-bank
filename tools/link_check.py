#!/usr/bin/env python3
"""Dead-link check for the Source links in topics/*.md (idea 10, docs/phase6-spec.md section 8).

Fails on 404, 410 or a host name that does not resolve, after one retry. 401, 403, 429 and timeouts are listed as
"blocked" and do not fail: many sites refuse automated requests. Runs in the weekly Links workflow, never on push,
because it needs the network.

Usage: python3 tools/link_check.py [--workers N]
"""
import argparse
import concurrent.futures as cf
import re
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = re.compile(r"https?://[^\s)>,\]]+")
DEAD = {404, 410}
AGENT = "qa-interview-bank-link-check/1.0 (+https://github.com/bartech-lab/qa-interview-bank)"


def source_links() -> dict[str, list[str]]:
    """URL -> where it appears (file and question id)."""
    found: dict[str, list[str]] = {}
    for f in sorted((ROOT / "topics").glob("*.md")):
        text = f.read_text(encoding="utf-8")
        for part in re.finditer(r"^\*\*Source:\*\*(.*?)(?=^\*\*[A-Z][\w -]*:\*\*|^#{2,3} |\Z)", text, re.M | re.S):
            ids = re.findall(r"id: (q\d{4})", text[:part.start()])
            for url in URL.findall(part.group(1)):
                found.setdefault(url.rstrip(".;"), []).append(f"{f.name} {ids[-1] if ids else '?'}")
    return found


def probe(url: str) -> tuple[str, str]:
    """('ok' | 'dead' | 'blocked', detail)."""
    for attempt in range(2):
        for method in ("HEAD", "GET"):
            req = urllib.request.Request(url, method=method, headers={"User-Agent": AGENT, "Accept": "*/*"})
            try:
                with urllib.request.urlopen(req, timeout=20) as r:
                    return "ok", str(r.status)
            except urllib.error.HTTPError as e:
                if e.code in DEAD:
                    status = ("dead", str(e.code))
                elif method == "HEAD" and e.code in (400, 403, 405, 429, 501):
                    continue  # some servers refuse HEAD only
                else:
                    status = ("blocked" if e.code in (401, 403, 429) or e.code >= 500 else "dead", str(e.code))
                break
            except urllib.error.URLError as e:
                if isinstance(e.reason, socket.gaierror):
                    status = ("dead", f"name does not resolve: {e.reason}")
                else:
                    status = ("blocked", f"{e.reason}")
                break
            except (TimeoutError, socket.timeout):
                status = ("blocked", "timeout")
                break
        else:
            status = ("blocked", "refused HEAD and GET")
        if status[0] != "dead" or attempt:
            return status
        time.sleep(5)
    return status


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    links = source_links()
    with cf.ThreadPoolExecutor(a.workers) as pool:
        results = dict(zip(links, pool.map(probe, links)))
    dead = {u: r for u, r in results.items() if r[0] == "dead"}
    blocked = {u: r for u, r in results.items() if r[0] == "blocked"}
    print(f"link_check: {len(links)} links, {len(links) - len(dead) - len(blocked)} ok, {len(blocked)} blocked, {len(dead)} dead")
    for title, group in (("blocked (not a failure)", blocked), ("dead", dead)):
        for u, (_, detail) in sorted(group.items()):
            print(f"{title}: {u} [{detail}] in {', '.join(links[u][:3])}")
    return 1 if dead else 0


if __name__ == "__main__":
    sys.exit(main())
