"""Phase 6, section 7: dist/questions.json (docs/phase6-spec.md, idea 71). Written from the spec only; "FMn" is failure mode n.

setUpClass runs `python3 tools/build.py` once. Run from the repository root:
python3 -m unittest discover -s tests/tools -t .
"""
import json
import re
import subprocess
import sys
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERSION = re.compile(r"^(\d{4}\.\d{2}\.\d{2}|local)\+[0-9a-f]{12}$")
KEYS = {"id", "title", "topic", "tier", "file", "section", "body"}
FENCE = re.compile(r"^(\s*)(```+|~~~+)\s*(.*)$")


def source_questions():
    """id -> (file stem, slug, tier, title) read straight from topics/."""
    out = {}
    for f in sorted((ROOT / "topics").glob("*.md")):
        title = ""
        for line in f.read_text(encoding="utf-8").split("\n"):
            if line.startswith("### "):
                title = line[4:].strip()
            m = re.match(r"^Topic: (\S+) \| (Core|Standard|Niche) \| id: (q\d+)", line)
            if m:
                out[m.group(3)] = (f.stem, m.group(1), m.group(2), title)
    return out


def fence_infos(text):
    infos, inside = [], False
    for line in text.split("\n"):
        m = FENCE.match(line)
        if not m:
            continue
        if not inside:
            infos.append(m.group(3).strip())
            inside = True
        elif not m.group(3).strip():
            inside = False
    return infos


class QuestionsJson(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        r = subprocess.run([sys.executable, "tools/build.py"], cwd=ROOT, capture_output=True, text=True, timeout=600)
        if r.returncode:
            raise AssertionError("build failed:\n" + r.stdout + r.stderr)
        cls.path = ROOT / "dist" / "questions.json"
        cls.data = json.loads(cls.path.read_text(encoding="utf-8"))
        cls.src = source_questions()

    def test_top_level_fields(self):
        d = self.data
        self.assertTrue({"dataVersion", "license", "source", "questions"} <= set(d), set(d))
        self.assertRegex(d["dataVersion"], VERSION)
        self.assertEqual(d["license"], "CC BY-SA 4.0")
        self.assertEqual(d["source"], "https://github.com/bartech-lab/qa-interview-bank")
        self.assertIsInstance(d["questions"], list)

    def test_data_version_date_is_the_date_of_the_newest_commit_that_changed_topics(self):
        git = subprocess.run(["git", "log", "-1", "--format=%cd", "--date=format:%Y.%m.%d", "--", "topics"], cwd=ROOT, capture_output=True, text=True)
        utc = subprocess.run(["git", "log", "-1", "--format=%cd", "--date=format-local:%Y.%m.%d", "--", "topics"], cwd=ROOT, capture_output=True, text=True,
                             env={"TZ": "UTC", "PATH": "/usr/bin:/bin"})
        if git.returncode or not git.stdout.strip():
            self.skipTest("no git history here")
        self.assertIn(self.data["dataVersion"].split("+")[0], {git.stdout.strip(), utc.stdout.strip()})

    def test_every_question_has_exactly_the_seven_fields(self):
        for q in self.data["questions"]:
            self.assertEqual(set(q), KEYS, q.get("id"))
            for k in KEYS:
                self.assertIsInstance(q[k], str, (q["id"], k))
                self.assertTrue(q[k].strip(), (q["id"], k))

    def test_one_entry_per_question_of_topics_in_id_order(self):
        ids = [q["id"] for q in self.data["questions"]]
        self.assertEqual(ids, sorted(ids))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids), set(self.src))
        self.assertGreater(len(ids), 1000)

    def test_fields_match_the_topics_files(self):
        for q in self.data["questions"]:
            stem, slug, tier, title = self.src[q["id"]]
            self.assertEqual(q["tier"], tier, q["id"])
            self.assertEqual(q["topic"], slug, q["id"])
            self.assertIn(q["file"].removesuffix(".md"), {stem}, q["id"])
            self.assertEqual(q["title"], title, q["id"])
            self.assertRegex(q["id"], r"^q\d{4}$")

    def test_section_is_the_heading_the_question_sits_under(self):
        q18 = next(q for q in self.data["questions"] if q["id"] == "q0018")
        self.assertIn("Locators", q18["section"])
        q19 = next(q for q in self.data["questions"] if q["id"] == "q0019")
        self.assertEqual(q18["section"], q19["section"])
        self.assertEqual(q18["file"].removesuffix(".md"), "01-playwright")

    def test_body_is_the_markdown_of_the_question(self):
        q18 = next(q for q in self.data["questions"] if q["id"] == "q0018")
        b = q18["body"]
        self.assertIn("**Say:** The recommended order is `getByRole` first", b)
        self.assertIn("**Full process:**", b)
        self.assertIn("**Source:** https://playwright.dev/docs/locators", b)
        self.assertIn("```ts", b)
        self.assertNotIn("<", b.split("**Say:**")[0].replace("<br>", ""), "no HTML wrapper before the answer")

    def test_fm32_no_run_or_seed_marks_on_any_code_fence_in_any_body(self):
        bad = []
        for q in self.data["questions"]:
            for info in fence_infos(q["body"]):
                words = info.split()
                if "run" in words or any(w.startswith("seed=") for w in words):
                    bad.append((q["id"], info))
        self.assertEqual(bad, [])

    def test_fm32_every_body_is_text_of_its_topics_file_so_no_mark_was_added_and_the_sql_answer_marks_stay(self):
        files = {f.stem: f.read_text(encoding="utf-8") for f in (ROOT / "topics").glob("*.md")}
        for q in self.data["questions"]:
            self.assertIn(q["body"].strip(), files[q["file"].removesuffix(".md")], q["id"])
        infos = [i for q in self.data["questions"] for i in fence_infos(q["body"])]
        self.assertTrue(any(i.startswith("sql answer") for i in infos))
        self.assertIn("ts", infos)

    def test_a_live_coding_question_keeps_its_starter_code_untouched(self):
        q = next(q for q in self.data["questions"] if q["id"] == "q1019")
        self.assertIn("// your code here", q["body"])
        self.assertIn("```ts\nimport assert from 'node:assert/strict';", q["body"])

    def test_the_zip_holds_the_same_questions_json(self):
        with zipfile.ZipFile(ROOT / "dist" / "qa-interview-bank.zip") as z:
            names = [n for n in z.namelist() if n.split("/")[-1] == "questions.json"]
            self.assertEqual(len(names), 1, z.namelist())
            self.assertEqual(json.loads(z.read(names[0])), self.data)


if __name__ == "__main__":
    unittest.main()
