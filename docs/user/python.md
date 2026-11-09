# Inspect and align a Python file

Python Check validates syntax with CPython, then reports detected alignment groups, their exact approval status and
candidate rows outside automatic layout coverage. Check never changes the source. Align can change horizontal layout
whitespace only after the applicable approval and write-safety checks pass. These workflows are described in
[Write, Refactor, Align and Check](modes.md).

## First check, without project setup

Use the installed BoxBox CLI or your plugin's configured launcher from the target repository root. Python 3.9 or later
through `python3` is required; BoxBox uses that interpreter's grammar, so syntax introduced in a newer version requires a matching
interpreter. `doctor` checks runtime availability; the per-file Check still needs to succeed.

Create `invoice.py`:

```python
first = 7
longer_name = 11
mid = 13

print(first + longer_name + mid)
```

Run each command separately; the initial Check intentionally returns exit status 1 for misalignment:

```bash
boxbox doctor --json
boxbox check --file invoice.py --json
python3 invoice.py
```

No `boxbox init` or external formatter is needed for this example. Doctor reports Python availability. Check reports
`syntax.status: "valid"`, one `FIXABLE` three-row group with axes `name`, `equal`, `value`, and the applicable
`py-simple-assignments` approval. `formatReadiness.verification` remains `"not-run"`: Check has not verified a write.
The source remains exactly as created, and running it prints `31`.

## Preview, apply and recheck

```bash
boxbox align --file invoice.py --dry-run --json
boxbox align --file invoice.py --json
boxbox check --file invoice.py --json
python3 invoice.py
boxbox align --file invoice.py --json
```

The preview reports the proposed line edits and `written: false`; the target stays untouched. Applying Align produces:

```python
first       = 7
longer_name = 11
mid         = 13

print(first + longer_name + mid)
```

The write reports `written: true` and `fixedPoint: true`. Recheck reports the detected group as `PASS` and returns 0.
The program still prints `31`. Repeating Align reports `written: false` because the file is already at the fixed point.
The parser and preservation gates check the transformation; behavior checks remain the project's responsibility.

## Detection and approval are separate

The recommended preset approves only three or more consecutive simple-name assignment rows with the exact axes
`name`, `equal`, `value`, at the same indentation. It does not approve every Python shape that the detector recognizes.
For example, both files below have detectable tables:

```python
options = {
    "a":1,
    "longer":2,
    "mid":3,
}
```

```python
a: int = 1
longer: int = 2
mid: int = 3
```

Save either example as `unsupported-approval.py`, then run:

```bash
boxbox check --file unsupported-approval.py --json
boxbox align --file unsupported-approval.py --dry-run --json
```

Check reports valid syntax and a `FIXABLE` group, but `formatReadiness.approvalEligible` is false and the exact approval
fact is `unknown`. Align returns status 2 with `ALIGN_NOT_ELIGIBLE`. Preview and apply both leave the original bytes
unchanged. Detection alone never grants a new approval.

## Read coverage and failures accurately

| Observation | Meaning and next action |
|---|---|
| Check returns 0, valid syntax, no groups and no applicable approval | Parsing succeeded and no supported table was found. This is not a whole-file style certificate. Align has no eligible table to write. |
| `results[0].unsupported` contains line numbers and reasons | Those candidate rows fall outside automatic layout coverage. Review them manually; their bytes remain unchanged. |
| An approved `PASS` group appears beside unsupported rows | The approved group is aligned; coverage remains partial. `approvalEligible` concerns detected eligible groups, so inspect `unsupported` too. |
| `syntax.status: "invalid"` | CPython rejected the input. Check returns 2 without alignment findings or a source change; fix the syntax first. |
| `syntax.status: "error"` | The parser was unavailable or failed. Check returns 2 and cannot establish syntax acceptance. Restore the Python runtime before retrying. |
| `ok: false` with a source-analysis or encoding error | Check could not produce a layout result. It returns 2 and preserves the original; resolve the runtime or source-format issue before retrying. |
| Guarded `boxbox run` reports `UNSUPPORTED` | A changed file lacks automatic layout coverage. A successful child command does not turn that result into `PASS`. |
| A post-edit hook reports `UNSUPPORTED` | The hook records the coverage gap without blocking or changing source. Inspect its linked receipt for the affected rows. |
| Check works but the host refuses an Align write in a read-only session | Runtime readiness and write permission are separate. Use a writable project/session for applying changes; a successful Check does not grant write permission. |

For example, `items[0]=1`, `items[1]=2` and `items[2]=3` are indexed targets outside automatic layout coverage. Other
current limits include Unicode identifier rows the profile cannot decompose, tuple-valued statements, assigned calls
with keyword arguments, some formatted-string-valued rows, and multiline assignment headers. Some supported rows inside a multiline container can still
be inspected. The report lists bounded layout candidates; it is not an exhaustive list of every unsupported Python
construct or a general style, type or semantic linter.

Single-line signatures, keyword calls, dictionary literals and lambda parameters can also be listed as unsupported.
Consequently, `UNSUPPORTED` is common for ordinary Python edits; it signals partial coverage rather than a syntax error.

AST and token analysis distinguishes real statements and containers from comments and string contents, including
nested formatted strings accepted by the installed Python. Inspection parses the target without executing it, and its
Python parser children run in isolated mode so project `ast.py`/`tokenize.py` files and `PYTHONPATH` cannot replace the
parser modules. Approved alignment preserves indentation, physical line separators, Unicode data, protected strings
and comment contents. Layout spaces before a comment may change; its text and trailing spaces are preserved.

Calling the CLI hook adapter verifies its inspection and receipt behavior. Native host event delivery depends on the
host's installed hook registration and needs separate evidence; a CLI invocation alone does not establish that delivery.

See the [inspection process](../development/inspection-process.md) for the parser, preservation, fixed-point and
atomic-write stages and their limits.

The [verification record](../development/reviews/2026-11-08-python-inspection.md) lists executable scenarios,
measured interpreter versions and the native host coverage limits.
