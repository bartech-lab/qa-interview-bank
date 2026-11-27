#!/usr/bin/env python3
"""Build dist/index.html (one offline file) and dist/qa-interview-bank.zip from topics/*.md and the page sources in src/:
src/index.html (the shell), src/style.css with the fonts in src/fonts as data: URIs, and src/js/*.js in the order of SCRIPTS. The scripts share one
classic <script> tag, so every top-level name stays global, as the inline onclick handlers need.
The question data and the third-party parts in vendor/ (made by tools/vendor.mjs) go in gzip-compressed and base64-encoded, in
<script type="application/x-gzip-base64" id="pack-NAME"> tags; the page unpacks each on first use (docs/phase3-spec.md).
Code blocks that can run on their own get "run" added to their fence (idea 39); SQL tasks get their section's seed tables.

Usage: python3 tools/build.py
Exit 1 when a question has no id, an id repeats, a question has no Topic line, a SQL task has no seed or not exactly one
```sql answer block, or dist/index.html is larger than BUDGET bytes (the size budget in docs/feasibility.md).
"""
import base64
import gzip
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPICS, DIST = ROOT / "topics", ROOT / "dist"
SRC = ROOT / "src"
SCRIPTS = ("pack", "data", "markdown", "answer", "editor", "run", "sql", "review", "backup", "navigation", "home", "learn", "quiz", "start")
VENDOR = ROOT / "vendor"
PACKS = {"codemirror": "codemirror.js", "sucrase": "sucrase.js", "sqljs": "sql-wasm.js", "sqlwasm": "sql-wasm.wasm"}
BUDGET = 4_500_000  # bytes for dist/index.html, docs/feasibility.md
FONT = re.compile(r"url\(fonts/([\w.-]+\.woff2)\)")
TOPIC = re.compile(r"^Topic: (\S+) \| (Core|Standard|Niche) \| id: (q\d{4})$", re.M)
FENCE = re.compile(r"^([ \t]*)```(\w+)([^\n]*)\n(.*?)^[ \t]*```", re.M | re.S)
STARTER = re.compile(r"^\*\*Starter:\*\*.*?(?=^\*\*[A-Z][\w -]*:\*\*|\Z)", re.M | re.S)
TS_IMPORT_OK = re.compile(r"""^import .* from '(node:assert|node:assert/strict|node:test)';$""")
# Names that mean the block needs a browser, Playwright, the network or Node APIs; "re.test(" or "homepage." do not count.
TS_BLOCKERS = re.compile(r"(?<![\w.$])(page\.|test\(|expect\(|fetch\(|process\.|require\(|declare )")
# Blocks that pass the rule below but cannot run in the page, as (question id, n-th code block of the question): reason.
NOT_RUNNABLE: dict[tuple[str, int], str] = {
    ("q0191", 1): "uses an enum, which Node's type stripping refuses, so its output cannot be checked against Node",
    ("q0217", 1): "shows a ReferenceError on purpose",
    ("q0418", 1): "PostgreSQL: generate_series is not in the page's SQLite",
    ("q0453", 2): "PostgreSQL: serial, timestamptz and a PL/pgSQL trigger",
}


def runnable(lang: str, code: str, seeded: bool) -> bool:
    """Idea 39: can this code block run on its own in the page? (docs/phase3-spec.md, Run buttons on answer blocks)"""
    if lang == "ts":
        imports = [l for l in code.splitlines() if l.startswith("import ")]
        return (("console.log" in code or "assert" in code) and all(TS_IMPORT_OK.match(l) for l in imports)
                and not TS_BLOCKERS.search(code))
    if lang == "sql":
        return seeded or "CREATE TABLE" in code.upper()
    return False


def mark_runnable(q: dict) -> None:
    """Add "run" to the fence of each runnable block outside the Starter (the starter is the editor's text)."""
    body, starter = q["body"], STARTER.search(q["body"])
    skip = range(starter.start(), starter.end()) if starter else range(0)
    n = 0
    def fence(m):
        nonlocal n
        n += 1
        lang, info = m.group(2), m.group(3)
        if m.start() in skip or "run" in info.split() or (q["id"], n) in NOT_RUNNABLE or not runnable(lang, m.group(4), "seed" in q):
            return m.group(0)
        seed = f" seed={q['id']}" if lang == "sql" and "seed" in q else ""  # the page runs it on this question's seed
        return f"{m.group(1)}```{lang}{info} run{seed}\n{m.group(4)}{m.group(0)[m.end(4) - m.start():]}"
    q["body"] = FENCE.sub(fence, body)


def questions() -> tuple[list, list]:
    qs, problems, ids = [], [], {}
    for f in sorted(TOPICS.glob("*.md")):
        text = f.read_text(encoding="utf-8")
        title, section, seed = text.splitlines()[0].lstrip("# "), "", None
        for chunk in re.split(r"(?m)^(?=#{2,3} )", text):
            head, _, body = chunk.partition("\n")
            if head.startswith("## "):
                section = head[3:].strip()
                # The section's seed: its intro's sql block that fills tables (the SQL whiteboard tasks share one).
                seed = next((m.group(4).strip() for m in FENCE.finditer(body) if m.group(2) == "sql" and "INSERT" in m.group(4).upper()), None)
            elif head.startswith("### "):
                q = head[4:].strip()
                m = TOPIC.search(body)
                if not m:
                    problems.append(f"{f.name}: no 'Topic: <topic> | <tier> | id: qNNNN' line under: {q}")
                    continue
                if m.group(3) in ids:
                    problems.append(f"{f.name}: id {m.group(3)} repeats ({ids[m.group(3)]})")
                ids[m.group(3)] = f.name
                item = {"id": m.group(3), "file": f.stem, "topic": title, "section": section, "q": q, "body": body.strip()}
                starter = STARTER.search(item["body"])
                sql_task = bool(starter and re.search(r"^```sql\s*$", starter.group(0), re.M))
                if seed and (sql_task or "```sql" in body):
                    item["seed"] = seed
                if sql_task:
                    answers = len(re.findall(r"^```sql answer\b", item["body"], re.M))
                    if "seed" not in item:
                        problems.append(f"{f.name}: SQL task {m.group(3)} has no seed (a ```sql block with INSERT in its section intro)")
                    if answers != 1:
                        problems.append(f"{f.name}: SQL task {m.group(3)} needs exactly one ```sql answer block, has {answers}")
                mark_runnable(item)
                qs.append(item)
    return qs, problems


def page_source() -> str:
    """The page with style and scripts put in place; the question data goes in last, so data text is never searched."""
    on_disk = sorted(f.stem for f in (SRC / "js").glob("*.js"))
    if on_disk != sorted(SCRIPTS):
        raise SystemExit(f"src/js holds {on_disk}; list every file in SCRIPTS in tools/build.py, in load order")
    page = (SRC / "index.html").read_text(encoding="utf-8")
    if page.count("</body>") != 1:
        raise SystemExit("src/index.html must hold </body> exactly once")
    # Third-party licences: one comment at the end of the page (docs/feasibility.md, rule 5).
    licences = (SRC / "fonts" / "OFL.txt").read_text(encoding="utf-8") + "\n" + "=" * 72 + "\n\n" + (VENDOR / "LICENSES.txt").read_text(encoding="utf-8")
    if "-->" in licences or "--!>" in licences:
        raise SystemExit('a licence text holds "-->", which ends the HTML comment early')
    page = page.replace("</body>", "<!--\n" + licences + "-->\n</body>")
    font = lambda m: "url(data:font/woff2;base64," + base64.b64encode((SRC / "fonts" / m.group(1)).read_bytes()).decode() + ")"
    parts = {"/*STYLE*/\n": FONT.sub(font, (SRC / "style.css").read_text(encoding="utf-8")),
             "/*SCRIPTS*/\n": "".join((SRC / "js" / f"{n}.js").read_text(encoding="utf-8") for n in SCRIPTS),
             "/*PACKS*/": "/*PACKS*/"}
    for mark, text in parts.items():
        if page.count(mark) != 1:
            raise SystemExit(f"src/index.html must hold {mark.strip()} exactly once")
        page = page.replace(mark, text)
    return page


def pack(name: str, data: bytes) -> str:
    """One part, gzip-compressed (mtime 0, so the build is reproducible) and base64-encoded, for unpack() in src/js/pack.js."""
    b64 = base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode()
    return f'<script type="application/x-gzip-base64" id="pack-{name}">{b64}</script>'


def main() -> int:
    qs, problems = questions()
    if problems:
        print(*problems, sep="\n", file=sys.stderr)
        return 1
    parts = {"data": json.dumps(qs, ensure_ascii=False).encode()} | {k: (VENDOR / f).read_bytes() for k, f in PACKS.items()}
    page = page_source().replace("/*PACKS*/", "\n".join(pack(k, v) for k, v in parts.items()))
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir()
    (DIST / "index.html").write_text(page, encoding="utf-8")
    size = (DIST / "index.html").stat().st_size
    if size > BUDGET:
        print(f"dist/index.html is {size:,} bytes, over the {BUDGET:,}-byte budget in docs/feasibility.md", file=sys.stderr)
        return 1
    with zipfile.ZipFile(DIST / "qa-interview-bank.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(DIST / "index.html", "qa-interview-bank/index.html")
        for name in ("README.md", "LICENSE", "LICENSE-CONTENT.md"):
            z.write(ROOT / name, f"qa-interview-bank/{name}")
        for f in sorted(TOPICS.glob("*.md")):
            z.write(f, f"qa-interview-bank/topics/{f.name}")
    print(f"OK: {len(qs)} questions -> dist/index.html ({size:,} bytes, budget {BUDGET:,}) and dist/qa-interview-bank.zip")
    return 0


if __name__ == "__main__":
    sys.exit(main())
