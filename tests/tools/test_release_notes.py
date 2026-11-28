"""Phase 6, section 7: tools/release_notes.py (docs/phase6-spec.md, idea 12). Written from the spec only; "FMn" is failure mode n.

Each test builds a throwaway git repository laid out like this one (topics/*.md), tags it, changes the questions and runs
`python3 tools/release_notes.py <tag> --repo <path>`. Run from the repository root:
python3 -m unittest discover -s tests/tools -t .
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOL = ROOT / "tools" / "release_notes.py"
VERSION = re.compile(r"(?:\d{4}\.\d{2}\.\d{2}|local)\+[0-9a-f]{12}")
KEPT = "Saved progress for removed questions is kept in your browser and in export files."


def q(qid, title, say="A short spoken answer.", slug="pw-core"):
    return f"### {title}\n\nTopic: {slug} | Core | id: {qid}\n\n**Say:** {say}\n\n**Source:** https://example.com/{qid}\n"


def topics_file(*questions):
    return "# Planted\n\n## Section 1: Planted\n\n" + "\n".join(questions)


def git(repo, *args, date="2026-11-20T12:00:00+0000"):
    env = {**os.environ, "GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull}
    r = subprocess.run(["git", "-c", "user.name=T", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", *args],
                       cwd=repo, env=env, capture_output=True, text=True)
    if r.returncode:
        raise AssertionError(f"git {args}: {r.stderr}")
    return r.stdout


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="qib-rn-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def repo(self, name="repo", files=None, date="2026-11-20T12:00:00+0000", tag="v1"):
        repo = self.tmp / name
        (repo / "topics").mkdir(parents=True)
        git(repo, "init", "-q")
        for fname, text in (files or {}).items():
            (repo / "topics" / fname).write_text(text, encoding="utf-8")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "first", date=date)
        if tag:
            git(repo, "tag", tag)
        return repo

    def notes(self, repo, tag="v1"):
        r = subprocess.run([sys.executable, str(TOOL), tag, "--repo", str(repo)], capture_output=True, text=True, cwd=ROOT, timeout=60)
        return r.returncode, r.stdout, r.stderr

    def lists(self, out):
        """Added, Removed, Changed -> (count in the header line, the text up to the next header)."""
        heads = {n: re.search(rf"^.*\b{n}: (\d+)\b.*$", out, re.M) for n in ("Added", "Removed", "Changed")}
        for n, m in heads.items():
            self.assertIsNotNone(m, f"no '{n}: N' line in:\n{out}")
        order = sorted(heads.items(), key=lambda kv: kv[1].start())
        res = {}
        for i, (n, m) in enumerate(order):
            end = order[i + 1][1].start() if i + 1 < len(order) else len(out)
            res[n] = (int(re.search(rf"{n}: (\d+)", m.group(0)).group(1)), out[m.end():end].replace(KEPT, ""))
        return res


class Lists(Base):
    def setUp(self):
        super().setUp()
        self.before = topics_file(q("q9001", "Stays the same?"), q("q9002", "Will be removed?"), q("q9003", "Body will change?", say="old words"),
                                  q("q9005", "Old title?"))
        self.after = topics_file(q("q9001", "Stays the same?"), q("q9003", "Body will change?", say="new words"),
                                 q("q9005", "A new title?"), q("q9004", "Brand new question?"))

    def test_added_removed_and_changed_by_id_with_titles(self):
        repo = self.repo(files={"01-x.md": self.before})
        (repo / "topics" / "01-x.md").write_text(self.after, encoding="utf-8")
        code, out, err = self.notes(repo)
        self.assertEqual(code, 0, err)
        r = self.lists(out)
        self.assertEqual(r["Added"][0], 1)
        self.assertEqual(r["Removed"][0], 1)
        self.assertEqual(r["Changed"][0], 2)
        self.assertIn("q9004", r["Added"][1])
        self.assertIn("Brand new question?", r["Added"][1])
        self.assertIn("q9002", r["Removed"][1])
        self.assertIn("Will be removed?", r["Removed"][1])
        for qid in ("q9003", "q9005"):
            self.assertIn(qid, r["Changed"][1])
        self.assertNotIn("q9001", out, "an unchanged question is not listed")
        for n in ("Added", "Changed"):
            self.assertNotIn("q9002", r[n][1])
        self.assertNotIn("q9004", r["Removed"][1] + r["Changed"][1])

    def test_a_line_with_the_data_version_and_the_removed_progress_sentence(self):
        repo = self.repo(files={"01-x.md": self.before})
        (repo / "topics" / "01-x.md").write_text(self.after, encoding="utf-8")
        code, out, _ = self.notes(repo)
        self.assertEqual(code, 0)
        self.assertRegex(out, VERSION)
        self.assertIn(KEPT, out)

    def test_no_removed_question_means_no_progress_sentence(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q9001", "One?"))})
        (repo / "topics" / "01-x.md").write_text(topics_file(q("q9001", "One?"), q("q9002", "Two?")), encoding="utf-8")
        code, out, _ = self.notes(repo)
        self.assertEqual(code, 0)
        self.assertNotIn(KEPT, out)
        r = self.lists(out)
        self.assertEqual([r[n][0] for n in ("Added", "Removed", "Changed")], [1, 0, 0])

    def test_nothing_changed_gives_three_zero_lists(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q9001", "One?"))})
        code, out, _ = self.notes(repo)
        self.assertEqual(code, 0)
        r = self.lists(out)
        self.assertEqual([r[n][0] for n in ("Added", "Removed", "Changed")], [0, 0, 0])
        self.assertNotIn(KEPT, out)
        self.assertNotRegex(out, r"q\d{4}")

    def test_a_question_moved_to_another_file_is_neither_added_nor_removed(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q9001", "One?"), q("q9002", "Two?")), "02-y.md": topics_file(q("q9003", "Three?"))})
        (repo / "topics" / "01-x.md").write_text(topics_file(q("q9001", "One?")), encoding="utf-8")
        (repo / "topics" / "02-y.md").write_text(topics_file(q("q9003", "Three?"), q("q9002", "Two?")), encoding="utf-8")
        code, out, _ = self.notes(repo)
        self.assertEqual(code, 0)
        r = self.lists(out)
        self.assertEqual(r["Added"][0], 0)
        self.assertEqual(r["Removed"][0], 0)

    def test_a_new_topics_file_adds_its_questions_and_a_deleted_file_removes_them(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q9001", "One?")), "02-y.md": topics_file(q("q9002", "Two?"))})
        (repo / "topics" / "02-y.md").unlink()
        (repo / "topics" / "03-z.md").write_text(topics_file(q("q9007", "Seven?")), encoding="utf-8")
        code, out, _ = self.notes(repo)
        self.assertEqual(code, 0)
        r = self.lists(out)
        self.assertIn("q9007", r["Added"][1])
        self.assertIn("q9002", r["Removed"][1])

    def test_each_list_stops_at_50_then_says_and_n_more(self):
        before = topics_file(*[q(f"q{3000 + i}", f"Old question {i}?") for i in range(51)])
        after = topics_file(*[q(f"q{2000 + i}", f"New question {i}?") for i in range(55)])
        repo = self.repo(files={"01-x.md": before})
        (repo / "topics" / "01-x.md").write_text(after, encoding="utf-8")
        code, out, _ = self.notes(repo)
        self.assertEqual(code, 0)
        r = self.lists(out)
        self.assertEqual(r["Added"][0], 55)
        self.assertEqual(len(set(re.findall(r"q\d{4}", r["Added"][1]))), 50)
        self.assertRegex(r["Added"][1], r"and 5 more")
        self.assertEqual(r["Removed"][0], 51)
        self.assertEqual(len(set(re.findall(r"q\d{4}", r["Removed"][1]))), 50)
        self.assertRegex(r["Removed"][1], r"and 1 more")

    def test_exactly_50_is_listed_in_full_without_and_n_more(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q1000", "Base?"))})
        (repo / "topics" / "01-x.md").write_text(topics_file(q("q1000", "Base?"), *[q(f"q{2000 + i}", f"New {i}?") for i in range(50)]), encoding="utf-8")
        code, out, _ = self.notes(repo)
        self.assertEqual(code, 0)
        r = self.lists(out)
        self.assertEqual(len(set(re.findall(r"q2\d{3}", r["Added"][1]))), 50)
        self.assertNotRegex(out, r"and \d+ more")

    def test_fm29_a_previous_tag_without_questions_json_still_lists_added_removed_and_changed(self):
        repo = self.repo(files={"01-x.md": self.before})
        self.assertFalse(list(repo.rglob("questions.json")))
        (repo / "topics" / "01-x.md").write_text(self.after, encoding="utf-8")
        code, out, err = self.notes(repo)
        self.assertEqual(code, 0, err)
        r = self.lists(out)
        self.assertEqual([r[n][0] for n in ("Added", "Removed", "Changed")], [1, 1, 2])

    def test_fm29_a_previous_tag_that_does_hold_a_questions_json_gives_the_same_lists_from_topics(self):
        repo = self.tmp / "withjson"
        (repo / "topics").mkdir(parents=True)
        git(repo, "init", "-q")
        (repo / "topics" / "01-x.md").write_text(self.before, encoding="utf-8")
        (repo / "questions.json").write_text('{"questions": []}', encoding="utf-8")
        (repo / "dist").mkdir()
        (repo / "dist" / "questions.json").write_text('{"questions": []}', encoding="utf-8")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "first")
        git(repo, "tag", "v1")
        (repo / "topics" / "01-x.md").write_text(self.after, encoding="utf-8")
        code, out, err = self.notes(repo)
        self.assertEqual(code, 0, err)
        r = self.lists(out)
        self.assertEqual([r[n][0] for n in ("Added", "Removed", "Changed")], [1, 1, 2])


class Version(Base):
    def test_the_date_is_the_commit_date_of_the_newest_commit_that_changed_topics(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q9001", "One?"))}, date="2026-11-20T12:00:00+0000")
        (repo / "topics" / "01-x.md").write_text(topics_file(q("q9001", "One?"), q("q9002", "Two?")), encoding="utf-8")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "topics", date="2026-11-22T12:00:00+0000")
        (repo / "README.md").write_text("later, not a topics change", encoding="utf-8")
        git(repo, "add", "-A")
        git(repo, "commit", "-q", "-m", "readme", date="2026-11-25T12:00:00+0000")
        code, out, err = self.notes(repo)
        self.assertEqual(code, 0, err)
        self.assertIn("2026.11.22+", out)
        self.assertNotIn("2026.11.25", out)
        self.assertRegex(out, VERSION)

    def test_same_questions_give_the_same_hex_whatever_the_date_and_other_questions_give_another(self):
        files = {"01-x.md": topics_file(q("q9001", "One?"), q("q9002", "Two?"))}
        a = self.repo("a", files, date="2026-11-20T12:00:00+0000")
        b = self.repo("b", files, date="2026-12-01T12:00:00+0000")
        c = self.repo("c", {"01-x.md": topics_file(q("q9001", "One?"), q("q9002", "Two?", say="other words"))}, date="2026-11-20T12:00:00+0000")
        hexes = []
        for r in (a, b, c):
            code, out, err = self.notes(r)
            self.assertEqual(code, 0, err)
            hexes.append(VERSION.search(out).group(0).split("+")[1])
        self.assertEqual(hexes[0], hexes[1])
        self.assertNotEqual(hexes[0], hexes[2])

    def test_a_changed_title_changes_the_hex_too(self):
        a = self.repo("a", {"01-x.md": topics_file(q("q9001", "One?"))})
        b = self.repo("b", {"01-x.md": topics_file(q("q9001", "One again?"))})
        ha = VERSION.search(self.notes(a)[1]).group(0).split("+")[1]
        hb = VERSION.search(self.notes(b)[1]).group(0).split("+")[1]
        self.assertNotEqual(ha, hb)


class UnknownTag(Base):
    def test_fm30_an_unknown_tag_exits_1_in_a_temp_repo(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q9001", "One?"))})
        code, out, err = self.notes(repo, tag="v-does-not-exist")
        self.assertEqual(code, 1, out + err)
        self.assertNotRegex(out, r"Added: \d+")

    def test_fm30_an_unknown_tag_exits_1_in_this_repository_by_default(self):
        r = subprocess.run([sys.executable, str(TOOL), "no-such-tag-qib-phase6"], capture_output=True, text=True, cwd=ROOT, timeout=60)
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        self.assertNotRegex(r.stdout, r"Added: \d+")

    def test_fm30_the_repo_option_points_the_tool_at_that_work_tree_not_this_one(self):
        repo = self.repo(files={"01-x.md": topics_file(q("q9001", "One?"))}, tag="only-here")
        code, out, err = self.notes(repo, tag="only-here")
        self.assertEqual(code, 0, err)
        self.assertEqual(self.notes(repo, tag="v1")[0], 1)


if __name__ == "__main__":
    unittest.main()
