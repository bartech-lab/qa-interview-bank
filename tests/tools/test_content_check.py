"""Phase 6, section 8: tools/content_check.py (docs/phase6-spec.md, idea 10). Written from the spec only; "FMn" is failure mode n.

Each test plants small question files in a temp directory and runs the tool on them. Run from the repository root:
python3 -m unittest discover -s tests/tools -t .
"""
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "content_check.py"


def block(qid, title, *, topic=True, say=True, source="https://example.com/doc", trap=True, full=True, follow=True):
    """One question as the files in topics/ write it. Returns the text."""
    parts = [f"### {title}", ""]
    if topic:
        parts += [f"Topic: pw-core | Core | id: {qid}", ""]
    if say:
        parts += ["**Say:** A short spoken answer.", ""]
    if full:
        parts += ["**Full process:**", "1. Step one.", ""]
    if follow:
        parts += ["**Follow-ups:**", "- *Why?* Because.", ""]
    if trap:
        parts += ["**Trap:** The answer that sounds right.", ""]
    if source is not None:
        parts += [f"**Source:** {source}", ""]
    return "\n".join(parts)


def doc(*blocks):
    return "\n".join(["# Planted file", "", "## Section 1: Planted", ""] + list(blocks))


def line_of(text, needle):
    for i, line in enumerate(text.split("\n"), 1):
        if needle in line:
            return i
    raise AssertionError(needle)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="qib-cc-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def write(self, name, text):
        p = self.tmp / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    def run_tool(self, *files, cwd=None):
        r = subprocess.run([sys.executable, str(TOOL), *map(str, files)], capture_output=True, text=True, cwd=cwd or ROOT, timeout=60)
        return r.returncode, r.stdout + r.stderr

    def names_line(self, out, lo, hi, qid=None, fname=None):
        """The output names the file, the id (when there is one) and a line inside [lo, hi]."""
        if fname:
            self.assertIn(fname, out)
        if qid:
            self.assertIn(qid, out)
        ints = [int(n) for n in re.findall(r"\b(\d+)\b", out)]
        self.assertTrue(any(lo <= n <= hi for n in ints), f"no line number in {lo}..{hi} in:\n{out}")


class CleanFiles(Base):
    def test_clean_file_exits_0(self):
        p = self.write("ok.md", doc(block("q9001", "What is a flaky test?"), block("q9002", "What is a fixture?")))
        code, out = self.run_tool(p)
        self.assertEqual(code, 0, out)

    def test_a_question_with_only_topic_and_say_passes(self):
        p = self.write("min.md", doc(block("q9001", "Minimal?", trap=False, full=False, follow=False, source=None)))
        code, out = self.run_tool(p)
        self.assertEqual(code, 0, out)

    def test_http_and_https_sources_pass(self):
        p = self.write("src.md", doc(block("q9001", "First?", source="https://example.com/a"), block("q9002", "Second?", source="http://example.com/b")))
        code, out = self.run_tool(p)
        self.assertEqual(code, 0, out)

    def test_the_real_bank_passes_without_arguments(self):
        code, out = self.run_tool()
        self.assertEqual(code, 0, out)

    def test_titles_that_differ_in_a_digit_or_a_space_are_not_duplicates(self):
        p = self.write("near.md", doc(block("q9001", "Is it A1?"), block("q9002", "Is it A2?"), block("q9003", "Set up CI"), block("q9004", "Setup CI")))
        code, out = self.run_tool(p)
        self.assertEqual(code, 0, out)

    def test_info_lines_count_questions_lacking_trap_full_process_follow_ups_and_source(self):
        text = doc(
            block("q9001", "One?", trap=False, full=False, follow=False, source=None),
            block("q9002", "Two?", trap=False, full=False, source=None),
            block("q9003", "Three?", trap=False, source=None),
            block("q9004", "Four?", source=None),
        )
        p = self.write("info.md", text)
        code, out = self.run_tool(p)
        self.assertEqual(code, 0, out)  # information only: never a failure
        want = {"Trap": 3, "Full process": 2, "Follow-ups": 1, "Source": 4}
        for name, n in want.items():
            lines = [l for l in out.split("\n") if name.lower() in l.lower()]
            self.assertTrue(lines, f"no line about {name} in:\n{out}")
            self.assertTrue(any(re.search(rf"\b{n}\b", l) for l in lines), f"{name}: {n} not on its line:\n{out}")


class Failures(Base):
    def test_fm31_missing_say_exits_1_naming_file_line_and_id(self):
        text = doc(block("q9001", "Fine?"), block("q9002", "No say here?", say=False))
        p = self.write("nosay.md", text)
        code, out = self.run_tool(p)
        self.assertEqual(code, 1, out)
        lo = line_of(text, "### No say here?")
        self.names_line(out, lo, len(text.split("\n")), "q9002", "nosay.md")
        self.assertNotIn("q9001", out)

    def test_fm31_missing_topic_line_exits_1_naming_file_and_line(self):
        text = doc(block("q9001", "Fine?"), block("q9002", "No topic here?", topic=False))
        p = self.write("notopic.md", text)
        code, out = self.run_tool(p)
        self.assertEqual(code, 1, out)
        lo = line_of(text, "### No topic here?")
        self.names_line(out, lo, len(text.split("\n")), None, "notopic.md")

    def test_fm31_duplicate_titles_after_lowercase_and_removing_punctuation_exit_1_naming_both_ids(self):
        text = doc(block("q9001", "What is `getByRole`?"), block("q9002", "Something else?"), block("q9003", "what is getByRole!"))
        p = self.write("dup.md", text)
        code, out = self.run_tool(p)
        self.assertEqual(code, 1, out)
        self.assertIn("dup.md", out)
        self.assertIn("q9001", out)
        self.assertIn("q9003", out)
        self.assertNotIn("q9002", out)

    def test_fm31_duplicate_titles_in_two_files_given_together(self):
        a = self.write("a.md", doc(block("q9001", "Same title?")))
        b = self.write("b.md", doc(block("q9002", "SAME TITLE")))
        code, out = self.run_tool(a, b)
        self.assertEqual(code, 1, out)
        self.assertIn("q9001", out)
        self.assertIn("q9002", out)
        code, out = self.run_tool(a)
        self.assertEqual(code, 0, "one file alone has no duplicate:\n" + out)

    def test_fm31_source_without_http_exits_1_naming_file_line_and_id(self):
        for bad in ("www.x.com", "[docs](docs/x.md)", "[x](www.x.com/a)"):
            with self.subTest(source=bad):
                text = doc(block("q9001", "Fine?"), block("q9002", "Bad source?", source=bad))
                p = self.write("badsrc.md", text)
                code, out = self.run_tool(p)
                self.assertEqual(code, 1, out)
                self.names_line(out, line_of(text, "### Bad source?"), len(text.split("\n")), "q9002", "badsrc.md")
                self.assertNotIn("q9001", out)

    def test_fm31_source_with_another_scheme_such_as_ftp_exits_1(self):
        text = doc(block("q9001", "Fine?"), block("q9002", "Ftp source?", source="ftp://example.com/file"))
        p = self.write("ftp.md", text)
        code, out = self.run_tool(p)
        self.assertEqual(code, 1, out)
        self.assertIn("q9002", out)

    def test_fm31_all_three_planted_in_one_run_each_named(self):
        text = doc(
            block("q9001", "Twin title?"),
            block("q9002", "No say?", say=False),
            block("q9003", "twin title"),
            block("q9004", "Bad link?", source="www.x.com"),
        )
        p = self.write("all.md", text)
        code, out = self.run_tool(p)
        self.assertEqual(code, 1, out)
        for qid in ("q9001", "q9002", "q9003", "q9004"):
            self.assertIn(qid, out)

    def test_a_clean_file_beside_a_bad_one_does_not_hide_the_failure(self):
        good = self.write("good.md", doc(block("q9001", "Good one?")))
        bad = self.write("bad.md", doc(block("q9002", "Bad one?", say=False)))
        code, out = self.run_tool(good, bad)
        self.assertEqual(code, 1, out)
        self.assertIn("bad.md", out)
        self.assertIn("q9002", out)

    def test_without_arguments_it_checks_every_topics_file_next_to_the_tool(self):
        tree = self.tmp / "repo"
        (tree / "tools").mkdir(parents=True)
        shutil.copy(TOOL, tree / "tools" / "content_check.py")
        (tree / "topics").mkdir()
        (tree / "topics" / "01-a.md").write_text(doc(block("q9001", "Fine?")), encoding="utf-8")
        (tree / "topics" / "02-b.md").write_text(doc(block("q9002", "Broken?", say=False)), encoding="utf-8")
        r = subprocess.run([sys.executable, str(tree / "tools" / "content_check.py")], capture_output=True, text=True, cwd=tree, timeout=60)
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 1, out)
        self.assertIn("02-b.md", out)
        self.assertIn("q9002", out)
        (tree / "topics" / "02-b.md").write_text(doc(block("q9002", "Fixed?")), encoding="utf-8")
        r = subprocess.run([sys.executable, str(tree / "tools" / "content_check.py")], capture_output=True, text=True, cwd=tree, timeout=60)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == "__main__":
    unittest.main()
