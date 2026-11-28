#!/usr/bin/env python3
"""Content checks for topics/*.md (idea 10, docs/phase6-spec.md section 8).

Fails (exit 1, naming file, line and id) when:
- a question has no "Topic: <topic> | <tier> | id: qNNNN" line, or no **Say:** part;
- two question titles are equal after lowercasing and keeping only letters, digits and spaces;
- a **Source:** part holds a link that does not start with http:// or https://.
Prints how many questions lack Trap, Full process, Follow-ups and Source, as information only.

Usage: python3 tools/content_check.py [file.md ...]   (default: every topics/*.md)
Dead links are checked by tools/link_check.py in the weekly Links workflow, not here: that needs the network.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPIC = re.compile(r"^Topic: (\S+) \| (Core|Standard|Niche) \| id: (q\d{4})$", re.M)
OPTIONAL = ("Trap", "Full process", "Follow-ups", "Source")
# A link in a Source part: a Markdown link target, a bare URL, or a bare domain-like word such as www.example.com.
LINK = re.compile(r"\]\(([^)\s]+)\)|(?<![\w/(.:-])((?:[a-z][a-z0-9+.-]*://|www\.)[^\s)>,]+|[a-z0-9-]+(?:\.[a-z0-9-]+)+/[^\s)>,]*)", re.I)


def norm(title: str) -> str:
    return " ".join(re.sub(r"[^\w\s]|_", " ", title.lower()).split())


def questions(path: Path):
    """(line number, title, body) for each ### question in the file."""
    lines, out, cur = path.read_text(encoding="utf-8").splitlines(), [], None
    for n, line in enumerate(lines, 1):
        if line.startswith("### "):
            cur = [n, line[4:].strip(), []]
            out.append(cur)
        elif line.startswith("## ") or line.startswith("# "):
            cur = None
        elif cur:
            cur[2].append(line)
    return [(n, t, "\n".join(b)) for n, t, b in out]


def source_part(body: str) -> str:
    m = re.search(r"^\*\*Source:\*\*(.*?)(?=^\*\*[A-Z][\w -]*:\*\*|\Z)", body, re.M | re.S)
    return m.group(1) if m else ""


def main(argv: list[str]) -> int:
    files = [Path(a) for a in argv] or sorted((ROOT / "topics").glob("*.md"))
    problems, titles, missing, total = [], {}, {k: 0 for k in OPTIONAL}, 0
    for f in files:
        name = f.relative_to(ROOT) if f.resolve().is_relative_to(ROOT) else f
        for line, title, body in questions(f):
            total += 1
            m = TOPIC.search(body)
            qid = m.group(3) if m else "no id"
            where = f"{name}:{line} {qid}"
            if not m:
                problems.append(f"{where}: no 'Topic: <topic> | <tier> | id: qNNNN' line under: {title}")
            if not re.search(r"^\*\*Say:\*\*", body, re.M):
                problems.append(f"{where}: no **Say:** part")
            key = norm(title)
            if key in titles:
                problems.append(f"{where}: same title as {titles[key]}: {title}")
            else:
                titles[key] = where
            for link in (a or b for a, b in LINK.findall(source_part(body))):
                if not re.match(r"https?://", link):
                    problems.append(f"{where}: Source link does not start with http:// or https://: {link}")
            for k in OPTIONAL:
                if not re.search(rf"^\*\*{re.escape(k)}:\*\*", body, re.M):
                    missing[k] += 1
    print(f"content_check: {total} questions; without " + ", ".join(f"{k}: {n}" for k, n in missing.items()) + " (information only)")
    if problems:
        print(*problems, sep="\n", file=sys.stderr)
        print(f"content_check: {len(problems)} problem(s)", file=sys.stderr)
        return 1
    print("content_check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
