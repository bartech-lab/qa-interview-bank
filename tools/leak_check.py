#!/usr/bin/env python3
"""Fail when published text makes a claim about one person's career, or names a private term.

Two checks:
1. Personal history (public patterns, always on): lines such as "I have used X", "in a previous job",
   "my experience". The bank is a script any candidate can read aloud, so such a line is either reworded
   or reviewed once and added to tools/reviewed-lines.txt.
2. Private denylist (names of employers, clients, people): read from the file in $QIB_DENYLIST, which
   never enters the repository. Without the file this check is skipped, unless --require-denylist.

Usage: python3 tools/leak_check.py [--require-denylist] [--accept]
  --accept  add every current hit to tools/reviewed-lines.txt (only after reading each one).
Exit 1 on any unreviewed hit, or when --require-denylist is given and the file is missing.
"""
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REVIEWED = ROOT / "tools" / "reviewed-lines.txt"
DEFAULT_DENYLIST = Path.home() / "logbook/Projects/qa-interview-bank/denylist.txt"
PERSONAL = re.compile(
    r"\b(I have (not |only )?(used|worked|run|written|done|tested|been)|I haven't|I've (used|worked)|I used|I worked|"
    r"I ran it|I did (this|both|not)|my (own )?(experience|projects?|work|team|suite|daily|current|languages|cloud|career|rules?)|"
    r"our (suite|team|merge requests|locators|tests)|previous (job|role|employer)|in practice with|years of|I was|I joined|"
    r"I led|I owned|I started|I tried|I fixed|I built|I wrote|I removed|I added|I moved|I turned|I made|I cited|I had)\b",
    re.I,
)


def tracked_text_files() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.split()
    return [ROOT / p for p in out if p.endswith((".md", ".html", ".py", ".mjs", ".js", ".ts", ".json", ".yml", ".yaml", ".txt"))
            and p != "tools/reviewed-lines.txt" and (ROOT / p).is_file()]


def key(path: Path, line: str) -> str:
    return hashlib.sha1(f"{path.relative_to(ROOT)}\0{line.strip()}".encode()).hexdigest()


def main() -> int:
    accept, require = "--accept" in sys.argv, "--require-denylist" in sys.argv
    deny_path = Path(os.environ.get("QIB_DENYLIST", DEFAULT_DENYLIST))
    deny = None
    if deny_path.is_file():
        terms = [t.strip() for t in deny_path.read_text(encoding="utf-8").splitlines() if t.strip()]
        deny = re.compile(r"(?<!\w)(" + "|".join(map(re.escape, terms)) + r")(?!\w)", re.I) if terms else None
    elif require:
        print(f"leak_check: denylist not found at {deny_path}; set QIB_DENYLIST", file=sys.stderr)
        return 1
    else:
        print("leak_check: no denylist file, private-name check skipped", file=sys.stderr)
    reviewed = set(REVIEWED.read_text().split()) if REVIEWED.exists() else set()
    hits = []
    for path in tracked_text_files():
        in_code = False
        for n, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if line.lstrip().startswith("```"):
                in_code = not in_code
                continue
            kinds = []
            if path.parent.name == "topics" and not in_code and PERSONAL.search(line):
                kinds.append("personal")
            if deny and deny.search(line):
                kinds.append("denylist")
            if kinds and key(path, line) not in reviewed:
                hits.append((path, n, line, kinds))
    if accept:
        REVIEWED.write_text("\n".join(sorted(reviewed | {key(p, l) for p, _, l, _ in hits})) + "\n")
        print(f"leak_check: accepted {len(hits)} lines")
        return 0
    for path, n, line, kinds in hits:
        shown = deny.sub("<private>", line) if deny else line
        print(f"{path.relative_to(ROOT)}:{n}: [{','.join(kinds)}] {shown.strip()[:200]}")
    if hits:
        print(f"leak_check: {len(hits)} unreviewed hits. Reword each line as advice to the reader, or, if it is fine,"
              " run `python3 tools/leak_check.py --accept` and commit tools/reviewed-lines.txt. See README.md.")
    else:
        print("leak_check: OK")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
