#!/usr/bin/env python3
"""Build dist/index.html (one offline file) and dist/qa-interview-bank.zip from topics/*.md and the page sources in src/:
src/index.html (the shell), src/style.css and src/js/*.js in the order of SCRIPTS. The scripts share one
classic <script> tag, so every top-level name stays global, as the inline onclick handlers need.

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
SRC = ROOT / "src"
SCRIPTS = ("data", "markdown", "answer", "editor", "navigation", "home", "learn", "quiz", "start")
TOPIC = re.compile(r"^Topic: (\S+) \| (Core|Standard|Niche) \| id: (q\d{4})$", re.M)


def questions() -> tuple[list, list]:
    qs, problems, ids = [], [], {}
    for f in sorted(TOPICS.glob("*.md")):
        text = f.read_text(encoding="utf-8")
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


def page_source() -> str:
    """The page with style and scripts put in place; the question data goes in last, so data text is never searched."""
    on_disk = sorted(f.stem for f in (SRC / "js").glob("*.js"))
    if on_disk != sorted(SCRIPTS):
        raise SystemExit(f"src/js holds {on_disk}; list every file in SCRIPTS in tools/build.py, in load order")
    page = (SRC / "index.html").read_text(encoding="utf-8")
    parts = {"/*STYLE*/\n": (SRC / "style.css").read_text(encoding="utf-8"),
             "/*SCRIPTS*/\n": "".join((SRC / "js" / f"{n}.js").read_text(encoding="utf-8") for n in SCRIPTS),
             "/*DATA*/": "/*DATA*/"}
    for mark, text in parts.items():
        if page.count(mark) != 1:
            raise SystemExit(f"src/index.html must hold {mark.strip()} exactly once")
        page = page.replace(mark, text)
    return page


def main() -> int:
    qs, problems = questions()
    if problems:
        print(*problems, sep="\n", file=sys.stderr)
        return 1
    data = json.dumps(qs, ensure_ascii=False).replace("</", "<\\/")
    page = page_source().replace("/*DATA*/", data)
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir()
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
