"""Exercise the CLI against real temporary Git worktrees."""

import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "snapshot.py"


class SnapshotTests(unittest.TestCase):

	def setUp(self):
		self.temporary = tempfile.TemporaryDirectory()
		self.addCleanup(self.temporary.cleanup)
		self.base     = Path(self.temporary.name).resolve()
		self.root     = self.base / "repo"
		self.snapshot = self.base / "selected.json"
		self.root.mkdir()
		self.git("init", "--initial-branch=work")
		self.git("config", "user.name", "Snapshot Test")
		self.git("config", "user.email", "snapshot@example.invalid")
		(self.root / "selected.txt").write_bytes(b"before\n")
		(self.root / "other.txt").write_bytes(b"outside selection\n")
		self.git("add", ".")
		self.git("commit", "-m", "Initial input")

	def git(self, *arguments):
		return subprocess.run(["git", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=", "-C", str(self.root), *arguments], capture_output=True, text=True, check=True).stdout.strip()

	def run_cli(self, operation, *paths, root=None, snapshot=None):
		result = subprocess.run(
			[sys.executable, str(SCRIPT), operation, "--root", str(root or self.root), "--snapshot", str(snapshot or self.snapshot), "--", *paths],
			capture_output=True, text=True, check=False,
		)
		self.assertEqual(result.stderr, "")
		return result.returncode, json.loads(result.stdout)

	def capture(self, *paths):
		code, result = self.run_cli("capture", *(paths or ("selected.txt",)))
		self.assertEqual(code, 0, result)
		return result

	def test_capture_and_verify_selected_regular_file(self):
		result = self.capture()
		record = result["files"][0]
		self.assertEqual(record["sha256"], hashlib.sha256(b"before\n").hexdigest())
		self.assertEqual(record["size"], 7)
		self.assertEqual(result["identity"]["root"], str(self.root))
		self.assertEqual(result["identity"]["branch"], "refs/heads/work")
		code, result = self.run_cli("verify")
		self.assertEqual((code, result["status"], result["changes"]), (0, "match", []))

	def test_changed_bytes_are_reported(self):
		self.capture()
		(self.root / "selected.txt").write_bytes(b"after\n")
		code, result = self.run_cli("verify")
		self.assertEqual(code, 1, result)
		self.assertEqual(result["changes"][0]["kind"], "content")
		self.assertEqual(result["changes"][0]["actual_sha256"], hashlib.sha256(b"after\n").hexdigest())

	def test_mode_change_is_reported(self):
		self.capture()
		path = self.root / "selected.txt"
		mode = stat.S_IMODE(path.stat().st_mode)
		path.chmod(mode ^ (stat.S_IWRITE if os.name == "nt" else stat.S_IXUSR))
		self.addCleanup(path.chmod, mode)
		code, result = self.run_cli("verify")
		self.assertEqual(code, 1, result)
		self.assertEqual([change["kind"] for change in result["changes"]], ["mode"])

	def test_deleted_file_is_reported(self):
		self.capture()
		(self.root / "selected.txt").unlink()
		code, result = self.run_cli("verify")
		self.assertEqual(code, 1, result)
		self.assertEqual(result["changes"], [{"path": "selected.txt", "kind": "deleted"}])

	def test_unselected_changes_do_not_expand_the_certificate(self):
		self.capture()
		(self.root / "other.txt").write_bytes(b"changed\n")
		(self.root / "new.txt").write_bytes(b"new\n")
		code, result = self.run_cli("verify")
		self.assertEqual((code, result["scope"]), (0, ["selected.txt"]))

	def test_new_commit_is_provenance_not_a_content_failure(self):
		self.capture()
		(self.root / "other.txt").write_bytes(b"changed\n")
		self.git("add", "other.txt")
		self.git("commit", "-m", "Change an unselected file")
		code, result = self.run_cli("verify")
		self.assertEqual((code, result["status"], result["head_changed"]), (0, "match", True))

	def test_different_branch_fails_even_with_identical_content(self):
		self.capture()
		self.git("checkout", "-b", "another")
		code, result = self.run_cli("verify")
		self.assertEqual(code, 1, result)
		self.assertEqual(result["changes"], [{
			"kind"     : "branch"         ,
			"expected" : "refs/heads/work",
			"actual"   : "refs/heads/another"
		}])

	def test_different_worktree_root_fails(self):
		self.capture()
		other = self.base / "other-worktree"
		self.git("worktree", "add", str(other), "-b", "another")
		code, result = self.run_cli("verify", root=other)
		self.assertEqual(code, 1, result)
		self.assertIn("root", [change["kind"] for change in result["changes"]])

	def test_traversal_absolute_and_missing_paths_are_refused(self):
		outside = self.base / "outside.txt"
		outside.write_text("outside", encoding="utf-8")
		for name in ("../outside.txt", str(outside), "missing.txt", "./selected.txt", ".git/config", "a/../selected.txt", "C:/outside.txt"):
			with self.subTest(name=name):
				code, result = self.run_cli("capture", name)
				self.assertEqual((code, result["status"]), (2, "error"))
				self.assertFalse(self.snapshot.exists())

	def test_file_and_parent_symlinks_are_refused(self):
		(self.root / "link.txt").symlink_to(self.root / "selected.txt")
		(self.root / "linked").symlink_to(self.root, target_is_directory=True)
		for name in ("link.txt", "linked/selected.txt"):
			with self.subTest(name=name):
				code, result = self.run_cli("capture", name)
				self.assertEqual((code, result["status"]), (2, "error"))
		self.capture()
		(self.root / "selected.txt").unlink()
		(self.root / "selected.txt").symlink_to(self.root / "other.txt")
		code, result = self.run_cli("verify")
		self.assertEqual((code, result["status"]), (2, "error"))

	def test_directory_duplicate_and_empty_selections_are_refused(self):
		(self.root / "directory").mkdir()
		for names in (("directory",), ("selected.txt", "selected.txt"), ()):
			with self.subTest(names=names):
				code, result = self.run_cli("capture", *names)
				self.assertEqual((code, result["status"]), (2, "error"))

	def test_snapshot_must_be_external_and_cannot_be_overwritten(self):
		code, result = self.run_cli("capture", "selected.txt", snapshot=self.root / "snapshot.json")
		self.assertEqual((code, result["status"]), (2, "error"))
		self.capture()
		before = self.snapshot.read_bytes()
		code, result = self.run_cli("capture", "selected.txt")
		self.assertEqual((code, result["status"]), (2, "error"))
		self.assertEqual(self.snapshot.read_bytes(), before)

	def test_tampered_snapshot_paths_are_refused(self):
		self.capture()
		snapshot = json.loads(self.snapshot.read_text(encoding="utf-8"))
		snapshot["files"][0]["path"] = "../outside.txt"
		self.snapshot.write_text(json.dumps(snapshot), encoding="utf-8")
		code, result = self.run_cli("verify")
		self.assertEqual((code, result["status"]), (2, "error"))

	def test_snapshot_symlink_is_refused_without_touching_its_target(self):
		target = self.base / "target.json"
		target.write_bytes(b"untouched\n")
		self.snapshot.symlink_to(target)
		for operation in ("capture", "verify"):
			with self.subTest(operation=operation):
				paths = ("selected.txt",) if operation == "capture" else ()
				code, result = self.run_cli(operation, *paths)
				self.assertEqual((code, result["status"]), (2, "error"))
				self.assertEqual(target.read_bytes(), b"untouched\n")

	def test_detached_head_is_refused(self):
		self.git("checkout", "--detach")
		code, result = self.run_cli("capture", "selected.txt")
		self.assertEqual((code, result["status"]), (2, "error"))


if __name__ == "__main__":
	unittest.main()
