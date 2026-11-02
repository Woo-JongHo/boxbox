#!/usr/bin/env python3
"""Validate issue records with Python's standard library.

Supported JSON Schema subset: object/array/string/integer types, required,
additionalProperties=false, properties, items, minItems, uniqueItems, minLength,
pattern, enum, const and minimum. $schema, title and description are annotations.
Unknown keywords and unsupported type/additionalProperties values are rejected,
including in optional schema branches. This is not a full Draft 2020-12 validator.
Repository checks additionally cover stable IDs, references, history and resolution. Historical `history[].evidence` paths may resolve only through the exact relocation map below. It confirms a current physical target exists; it does not claim byte identity with the historical source.
"""

import argparse
import json
import re
import sys
from pathlib import Path

LIBRARY = Path(__file__).resolve().parent
REPOSITORY = LIBRARY.parents[2]
# Historical evidence uses these exact paths only; current artifacts must use current paths.
# These exact historical relocations locate the current physical source; they do not prove historical byte identity.
HISTORICAL_SOURCE_RELOCATIONS = {
	"product/engine/typescript/grid-kinds.ts" : "product/engine/typescript/13_grid-kinds.ts",
	"product/engine/python/profile.ts"        : "product/engine/python/03_profile.ts"       ,
	"product/engine/common/result-json.ts"    : "product/engine/common/24_result-json.ts"   ,
	"product/engine/common/report.ts"         : "product/engine/common/23_report.ts"        ,
	"product/engine/common/table-engine.ts"   : "product/engine/common/06_table-engine.ts"  ,
}
KEYWORDS = {
	"$schema", "title", "description", "type", "required", "additionalProperties",
	"properties", "items", "minItems", "uniqueItems", "minLength", "pattern",
	"enum", "const", "minimum",
}


def require(condition, message):
	if not condition:
		raise ValueError(message)


def validate_schema(rule, path="schema"):
	require(isinstance(rule, dict), f"{path}: expected an object schema")
	require(not set(rule) - KEYWORDS, f"{path}: unsupported keywords {set(rule) - KEYWORDS}")
	if "type" in rule:
		require(rule["type"] in ("object", "array", "string", "integer"), f"{path}: unsupported type")
	if "additionalProperties" in rule:
		require(rule["additionalProperties"] is False, f"{path}: only additionalProperties=false is supported")
	for name, child in rule.get("properties", {}).items():
		validate_schema(child, f"{path}.{name}")
	if "items" in rule:
		validate_schema(rule["items"], f"{path}.items")


def equal(left, right):
	if isinstance(left, bool) != isinstance(right, bool):
		return False
	return left == right


def validate(value, rule, path):
	if "const" in rule:
		require(equal(value, rule["const"]), f"{path}: unexpected constant")
	if "enum" in rule:
		require(any(equal(value, option) for option in rule["enum"]), f"{path}: unsupported value {value!r}")
	if "type" in rule:
		matches = {
			"object": isinstance(value, dict),
			"array": isinstance(value, list),
			"string": isinstance(value, str),
			"integer": type(value) is int or (type(value) is float and value.is_integer()),
		}
		require(matches[rule["type"]], f"{path}: expected {rule['type']}")
	count = 1
	if isinstance(value, dict):
		require(set(rule.get("required", [])) <= set(value), f"{path}: missing required fields")
		if rule.get("additionalProperties") is False:
			require(set(value) <= set(rule.get("properties", {})), f"{path}: unexpected fields")
		for name, child in rule.get("properties", {}).items():
			if name in value:
				count += validate(value[name], child, f"{path}.{name}")
	if isinstance(value, list):
		require(len(value) >= rule.get("minItems", 0), f"{path}: too few items")
		if rule.get("uniqueItems"):
			require(len({json.dumps(item, sort_keys=True) for item in value}) == len(value), f"{path}: duplicate items")
		if "items" in rule:
			for index, item in enumerate(value):
				count += validate(item, rule["items"], f"{path}[{index}]")
	if isinstance(value, str):
		require(len(value) >= rule.get("minLength", 0), f"{path}: text is too short")
		if "pattern" in rule:
			require(re.search(rule["pattern"], value) is not None, f"{path}: pattern mismatch")
	if "minimum" in rule:
		require(value >= rule["minimum"], f"{path}: below minimum")
	return count


def repository_file(file, path, purpose):
	relative = Path(path)
	require(not relative.is_absolute() and ".." not in relative.parts, f"{file}: {purpose} must be repository-relative: {path}")
	try:
		resolved = (REPOSITORY / relative).resolve(strict=True)
	except FileNotFoundError:
		require(False, f"{file}: missing {purpose}: {path}")
	try:
		resolved.relative_to(REPOSITORY.resolve())
	except ValueError:
		require(False, f"{file}: {purpose} resolves outside the repository: {path}")
	require(resolved.is_file(), f"{file}: missing {purpose}: {path}")
	return resolved


def validate_history_evidence(file, path):
	relative = Path(path)
	require(not relative.is_absolute() and ".." not in relative.parts, f"{file}: evidence must be repository-relative: {path}")
	raw = REPOSITORY / relative
	if raw.exists() or raw.is_symlink():
		repository_file(file, path, "historical evidence")
		return False
	target = HISTORICAL_SOURCE_RELOCATIONS.get(path)
	require(target is not None, f"{file}: missing historical evidence: {path}")
	target_path = Path(target)
	require(not target_path.is_absolute() and ".." not in target_path.parts, f"{file}: invalid historical relocation target: {target}")
	repository_file(file, target, "relocated historical evidence")
	return True


def validate_record(record, file):
	require(file.name.startswith(record["id"] + "-"), f"{file}: filename must start with its ID and a hyphen")
	sequence = [entry["sequence"] for entry in record["history"]]
	require(sequence == list(range(1, len(sequence) + 1)), f"{file}: history sequence must start at 1 without gaps")
	references = [item["path"] for item in record["related"]]
	references += [path for item in record["verification"] for path in item["evidence"]]
	for path in references:
		repository_file(file, path, "reference")
	relocated = sum(
		validate_history_evidence(file, path)
		for entry in record["history"]
		for path in entry["evidence"]
	)
	references += [path for item in record["history"] for path in item["evidence"]]
	for item in record["verification"]:
		if item["status"] in ("passed", "failed"):
			require(bool(item["evidence"]), f"{file}: observed result needs evidence: {item['name']}")
	for entry in record["history"]:
		if entry["event"] == "verification-failed":
			require(entry.get("status") == "failed", f"{file}: verification-failed history needs status=failed")
		if entry.get("status") == "failed":
			require(entry["event"] == "verification-failed", f"{file}: failed history needs event=verification-failed")
		if entry.get("status") in ("passed", "failed"):
			require(bool(entry["evidence"]), f"{file}: historical result needs evidence")
	if record["status"] == "resolved":
		require(all(item["status"] == "done" for item in record["actions"]), f"{file}: resolved issue has unfinished actions")
		require(all(item["status"] == "passed" for item in record["verification"]), f"{file}: resolved issue has unpassed current verification")
	return len(references) - relocated, relocated


def main():
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("records", nargs="*", type=Path, help="Optional draft paths; defaults to the factual record set")
	args = parser.parse_args()
	schema = json.loads((LIBRARY / "issue.schema.json").read_text())
	validate_schema(schema)
	# The template's ID and date are instructional; all other schema constraints apply.
	template_schema = json.loads(json.dumps(schema))
	del template_schema["properties"]["id"]["pattern"]
	del template_schema["properties"]["history"]["items"]["properties"]["date"]["pattern"]
	validate(json.loads((LIBRARY / "templates/issue.json").read_text()), template_schema, "template")
	canonical_ids = {}
	for canonical in sorted((LIBRARY / "records").glob("*.json")):
		candidate = json.loads(canonical.read_text())
		require(isinstance(candidate, dict) and isinstance(candidate.get("id"), str), f"{canonical}: missing or invalid ID")
		identifier = candidate["id"]
		require(identifier not in canonical_ids, f"{canonical}: duplicate canonical ID {identifier}")
		canonical_ids[identifier] = canonical.resolve()
	files = args.records or sorted((LIBRARY / "records").glob("*.json"))
	require(bool(files), "No records found")
	identifiers = set()
	values                          = 0
	references                      = 0
	existing_references             = 0
	relocated_historical_references = 0
	for file in files:
		record = json.loads(file.read_text())
		values += validate(record, schema, str(file))
		canonical = canonical_ids.get(record["id"])
		require(canonical is None or canonical == file.resolve(), f"{file}: ID {record['id']} already belongs to {canonical}")
		record_references, record_relocated = validate_record(record, file)
		references += record_references + record_relocated
		existing_references += record_references
		relocated_historical_references += record_relocated
		require(record["id"] not in identifiers, f"{file}: duplicate ID {record['id']}")
		identifiers.add(record["id"])
	if not args.records:
		readme = (LIBRARY / "README.md").read_text()
		for target in re.findall(r"\]\(([^)]+)\)", readme):
			require((LIBRARY / target).exists(), f"README: missing link {target}")
		for identifier in identifiers:
			require(identifier in readme, f"README: missing index entry {identifier}")
	print(json.dumps({
		"status": "passed",
		"method": "Dependency-free Python checker for the documented schema subset; unknown keywords are rejected. Not a full Draft 2020-12 validator.",
		"records": len(files),
		"checkedValues"                           : values                         ,
		"referenceOccurrences"                    : references                     ,
		"existingReferenceOccurrences"            : existing_references            ,
		"relocatedHistoricalReferenceOccurrences" : relocated_historical_references,
		"checks": ["schema subset", "template fields and enum drift", "unique IDs including canonical/draft collisions", "filename agreement", "history sequencing and machine-readable failures", "existing repository references", "observed-result evidence", "resolved action/verification state", "README index and links when validating the library"],
		"excluded": "templates/issue.json is instructional and is not a factual record.",
	}, indent=2))


if __name__ == "__main__":
	try:
		main()
	except (ValueError, OSError) as error:
		print(f"Issue validation failed: {error}", file=sys.stderr)
		sys.exit(1)
