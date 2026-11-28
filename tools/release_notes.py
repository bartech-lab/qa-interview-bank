#!/usr/bin/env python3
"""Release notes for the question set (idea 12, docs/phase6-spec.md section 7).

Compares the questions in topics/ at a previous tag with the working tree, by id, and prints Markdown:
the data version, then the questions added, removed and changed (title or text), at most 50 of each.
Saved progress is keyed by question id, so it needs no migration; the notes say so when questions were removed.

Usage: python3 tools/release_notes.py <previous tag> [--repo <path>]
Exit 1 when the tag does not exist or a topics file cannot be read.
"""
import argparse
import io
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402  (questions() and data_version() are the build's own)

LIMIT = 50


def at_tag(repo: Path, tag: str, into: Path) -> Path:
    """Extract topics/ as it was at the tag into a temporary folder and return that topics folder."""
    ok = subprocess.run(["git", "rev-parse", "--verify", "--quiet", f"{tag}^{{commit}}"], cwd=repo, capture_output=True)
    if ok.returncode:
        raise SystemExit(f"release_notes: no tag or commit named {tag!r} in {repo}")
    data = subprocess.run(["git", "archive", "--format=tar", tag, "topics"], cwd=repo, capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(data)) as t:
        t.extractall(into, filter="data")
    return into / "topics"


def listing(title: str, items: list) -> list[str]:
    out = [f"{title}: {len(items)}"]
    out += [f"- {q['id']}: {q['q']}" for q in items[:LIMIT]]
    if len(items) > LIMIT:
        out.append(f"- and {len(items) - LIMIT} more")
    return out


def notes(repo: Path, tag: str) -> str:
    with tempfile.TemporaryDirectory() as tmp:
        old_qs, problems = build.questions(at_tag(repo, tag, Path(tmp)))
    new_qs, more = build.questions(repo / "topics")
    if problems or more:
        raise SystemExit("release_notes: " + "; ".join(problems + more))
    old, new = {q["id"]: q for q in old_qs}, {q["id"]: q for q in new_qs}
    added = [new[i] for i in sorted(new.keys() - old.keys())]
    removed = [old[i] for i in sorted(old.keys() - new.keys())]
    changed = [new[i] for i in sorted(new.keys() & old.keys()) if (new[i]["q"], new[i]["md"]) != (old[i]["q"], old[i]["md"])]
    lines = [f"Questions: data version {build.data_version(new_qs, repo)}, {len(new_qs)} questions (since {tag}).", ""]
    for title, items in (("Added", added), ("Removed", removed), ("Changed", changed)):
        lines += listing(title, items) + [""]
    if removed:
        lines.append("Saved progress for removed questions is kept in your browser and in export files.")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("tag")
    ap.add_argument("--repo", type=Path, default=build.ROOT)
    a = ap.parse_args()
    sys.stdout.write(notes(a.repo.resolve(), a.tag))
    return 0


if __name__ == "__main__":
    sys.exit(main())
