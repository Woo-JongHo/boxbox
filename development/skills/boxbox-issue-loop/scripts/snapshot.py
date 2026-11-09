#!/usr/bin/env python3
"""Snapshot explicit regular files; compare bytes, modes, root and branch."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys


SCHEMA_VERSION = 1


class Arguments(argparse.ArgumentParser):

	def error(self, message):
		raise ValueError(message)


def git(root, *arguments, optional=False):
	result = subprocess.run(
		["git", "--no-optional-locks", "-C", str(root), *arguments],
		capture_output=True, text=True, check=False,
	)
	if result.returncode and not optional:
		raise ValueError(result.stderr.strip() or "Git identity could not be read")

	return result.stdout.strip() if result.returncode == 0 else None


def identity(raw_root):
	root = Path(raw_root).resolve(strict=True)
	if not root.is_dir() or Path(git(root, "rev-parse", "--show-toplevel")).resolve() != root:
		raise ValueError("--root must identify the Git worktree root")

	branch = git(root, "symbolic-ref", "--quiet", "HEAD", optional=True)
	if not branch:
		raise ValueError("A named branch is required")

	return root, {
		"root"   : str(root),
		"branch" : branch   ,
		"head"   : git(root, "rev-parse", "--verify", "HEAD", optional=True)
	}


def selected_path(raw):
	if not isinstance(raw, str) or not raw or "\\" in raw or "\0" in raw:
		raise ValueError(f"Unsafe selected path: {raw!r}")

	path = PurePosixPath(raw)
	if path.is_absolute() or path.as_posix() != raw or any(part in {".", "..", ".git"} for part in path.parts):
		raise ValueError(f"Unsafe selected path: {raw!r}")
	if not path.parts or re.match(r"^[A-Za-z]:", raw):
		raise ValueError(f"Unsafe selected path: {raw!r}")

	return path.parts


def file_record(root, raw):
	parts   = selected_path(raw)
	current = root
	for index, part in enumerate(parts):
		current = current / part
		info = current.lstat()
		if stat.S_ISLNK(info.st_mode) or (not stat.S_ISREG(info.st_mode) if index == len(parts) - 1 else not stat.S_ISDIR(info.st_mode)):
			raise ValueError(f"Unsafe selected component: {raw!r}")

	before = current.stat()
	data   = current.read_bytes()
	after  = current.lstat()
	fields = ("st_dev", "st_ino", "st_mode", "st_size", "st_mtime_ns", "st_ctime_ns")
	if any(getattr(before, field) != getattr(after, field) for field in fields) or not stat.S_ISREG(after.st_mode):
		raise ValueError(f"Selected file changed while reading: {raw!r}")

	return {
		"path"   : raw                                 ,
		"mode"   : f"{stat.S_IMODE(after.st_mode):04o}",
		"size"   : len(data)                           ,
		"sha256" : hashlib.sha256(data).hexdigest()
	}


def external_snapshot(raw, root, existing):
	path = Path(raw).absolute()
	if path.is_symlink():
		raise ValueError("Snapshot must be a regular file, not a symlink")

	path = path.parent.resolve(strict=True) / path.name
	if path == root or root in path.parents:
		raise ValueError("Store runtime snapshots outside the repository")
	if existing and not path.is_file():
		raise ValueError("Snapshot must be an existing regular file")

	return path


def load_snapshot(path):
	with path.open(encoding="utf-8") as source:
		snapshot = json.load(source)
	if not isinstance(snapshot, dict) or snapshot.get("schema_version") != SCHEMA_VERSION:
		raise ValueError("Unsupported snapshot schema")
	if not isinstance(snapshot.get("root"), str) or not Path(snapshot["root"]).is_absolute():
		raise ValueError("Invalid snapshot root")
	if not isinstance(snapshot.get("branch"), str) or not snapshot["branch"].startswith("refs/heads/"):
		raise ValueError("Invalid snapshot branch")
	if snapshot.get("head") is not None and not isinstance(snapshot["head"], str):
		raise ValueError("Invalid snapshot HEAD provenance")

	files = snapshot.get("files")
	if not isinstance(files, list) or not files:
		raise ValueError("Snapshot must contain selected files")

	seen = set()
	for record in files:
		if not isinstance(record, dict):
			raise ValueError("Invalid snapshot file record")

		name = record.get("path")
		selected_path(name)
		if name in seen:
			raise ValueError("Duplicate selected path in snapshot")

		seen.add(name)
		if not re.fullmatch(r"[0-7]{4}", str(record.get("mode", ""))) or not re.fullmatch(r"[0-9a-f]{64}", str(record.get("sha256", ""))):
			raise ValueError("Invalid snapshot mode or SHA-256")
		if type(record.get("size")) is not int or record["size"] < 0:
			raise ValueError("Invalid snapshot byte count")

	return snapshot


def capture(root, current, path, paths):
	if not paths or len(set(paths)) != len(paths):
		raise ValueError("Select one or more distinct file paths")

	files    = [file_record(root, name) for name in sorted(paths)]
	snapshot = {
		"schema_version" : SCHEMA_VERSION,
		**current,
		"files"          : files
	}
	if identity(root)[1] != current:
		raise ValueError("Git identity changed during capture")

	with path.open("x", encoding="utf-8") as destination:
		json.dump(snapshot, destination, indent=2, sort_keys=True)
		destination.write("\n")

	return {
		"status"   : "captured",
		"snapshot" : str(path) ,
		"identity" : current   ,
		"files"    : files
	}, 0


def verify(root, current, path):
	snapshot = load_snapshot(path)
	changes  = []
	for key in ("root", "branch"):
		if snapshot[key] != current[key]:
			changes.append({
				"kind"     : key          ,
				"expected" : snapshot[key],
				"actual"   : current[key]
			})
	if not changes:
		for expected in snapshot["files"]:
			name = expected["path"]
			try:
				actual = file_record(root, name)
			except FileNotFoundError:
				changes.append({"path": name, "kind": "deleted"})
				continue
			if actual["sha256"] != expected["sha256"] or actual["size"] != expected["size"]:
				changes.append({
					"path"            : name              ,
					"kind"            : "content"         ,
					"expected_sha256" : expected["sha256"],
					"actual_sha256"   : actual["sha256"]  ,
					"expected_size"   : expected["size"]  ,
					"actual_size"     : actual["size"]
				})
			if actual["mode"] != expected["mode"]:
				changes.append({
					"path"     : name            ,
					"kind"     : "mode"          ,
					"expected" : expected["mode"],
					"actual"   : actual["mode"]
				})
	if identity(root)[1] != current:
		raise ValueError("Git identity changed during verification")

	return {
		"status"        : "changed" if changes else "match"               ,
		"snapshot"      : str(path)                                       ,
		"identity"      : current                                         ,
		"snapshot_head" : snapshot.get("head")                            ,
		"head_changed"  : snapshot.get("head") != current["head"]         ,
		"scope"         : [record["path"] for record in snapshot["files"]],
		"changes"       : changes
	}, 1 if changes else 0


def main(argv=None):
	try:
		parser = Arguments(description=__doc__)
		parser.add_argument("operation", choices=("capture", "verify"))
		parser.add_argument("--root", required=True)
		parser.add_argument("--snapshot", required=True)
		parser.add_argument("paths", nargs="*")

		options = parser.parse_args(argv)
		if options.operation == "verify" and options.paths:
			raise ValueError("verify uses only the paths stored in the snapshot")

		root, current = identity(options.root)
		path = external_snapshot(options.snapshot, root, options.operation == "verify")
		result, code = capture(root, current, path, options.paths) if options.operation == "capture" else verify(root, current, path)
		result.update({"schema_version": SCHEMA_VERSION, "operation": options.operation})
		print(json.dumps(result, sort_keys=True))
		return code
	except (OSError, ValueError, subprocess.SubprocessError) as error:
		print(json.dumps({
			"schema_version" : SCHEMA_VERSION,
			"status"         : "error"       ,
			"error"          : str(error)
		}, sort_keys=True))
		return 2


if __name__ == "__main__":
	sys.exit(main())
