#!/usr/bin/env python3
"""Build dist/index.html (one offline file) and dist/qa-interview-bank.zip from topics/*.md and src/app.html.

Usage: python3 tools/build.py
Exit 1 when a question has no id, an id repeats, or a question has no Topic line.
"""
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPICS, DIST = ROOT / "topics", ROOT / "dist"
TOPIC = re.compile(r"^Topic: (\S+) \| (Core|Standard|Niche) \| id: (q\d{4})$", re.M)
LABEL = re.compile(r"^(\*\*[A-Za-z -]+:\*\*|#{1,3} )")


def drop_polish(text: str) -> str:
    """The page has no language switch yet, so the Polish spoken answers (**Powiedz:**) are left out of the build."""
    out, skip = [], False
    for line in text.splitlines():
        if line.startswith("**Powiedz:**"):
            skip = True
            continue
        if skip and LABEL.match(line):
            skip = False
        if not skip:
            out.append(line)
    return "\n".join(out)


def questions() -> tuple[list, list]:
    qs, problems, ids = [], [], {}
    for f in sorted(TOPICS.glob("*.md")):
        text = drop_polish(f.read_text(encoding="utf-8"))
        title, section = text.splitlines()[0].lstrip("# "), ""
        for chunk in re.split(r"(?m)^(?=#{2,3} )", text):
            head, _, body = chunk.partition("\n")
            if head.startswith("## "):
                section = head[3:].strip()
            elif head.startswith("### "):
                q = head[4:].strip()
                m = TOPIC.search(body)
                if not m:
                    problems.append(f"{f.name}: no 'Topic: <topic> | <tier> | id: qNNNN' line under: {q}")
                    continue
                if m.group(3) in ids:
                    problems.append(f"{f.name}: id {m.group(3)} repeats ({ids[m.group(3)]})")
                ids[m.group(3)] = f.name
                qs.append({"id": m.group(3), "file": f.stem, "topic": title, "section": section, "q": q, "body": body.strip()})
    return qs, problems


def main() -> int:
    qs, problems = questions()
    if problems:
        print(*problems, sep="\n", file=sys.stderr)
        return 1
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir()
    data = json.dumps(qs, ensure_ascii=False).replace("</", "<\\/")
    page = (ROOT / "src" / "app.html").read_text(encoding="utf-8").replace("/*DATA*/", data)
    (DIST / "index.html").write_text(page, encoding="utf-8")
    with zipfile.ZipFile(DIST / "qa-interview-bank.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(DIST / "index.html", "qa-interview-bank/index.html")
        for name in ("README.md", "LICENSE", "LICENSE-CONTENT.md"):
            z.write(ROOT / name, f"qa-interview-bank/{name}")
        for f in sorted(TOPICS.glob("*.md")):
            z.write(f, f"qa-interview-bank/topics/{f.name}")
    print(f"OK: {len(qs)} questions -> dist/index.html ({(DIST / 'index.html').stat().st_size // 1024} KB) and dist/qa-interview-bank.zip")
    return 0


if __name__ == "__main__":
    sys.exit(main())
