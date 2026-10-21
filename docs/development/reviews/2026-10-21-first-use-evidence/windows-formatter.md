# Formatter process implementation evidence

## Ownership and implementation

Owned only `product/engine/common/formatter-process.ts` and `test/formatter-process.test.ts`. No other repository files were edited by this worker. The root agent owns pipeline integration, CLI readiness, approval data, documentation, packaging, and SSH validation.

Exports are `PipelineProcessResult`, `ExecutableIdentity`, `resolveFormatterExecutable(command, root)`, and `runFormatterProcess(executable, config, file, root)`.

- POSIX command resolution preserves PATH lookup, realpath/regular/executable-file checks, and metadata identity fingerprints.
- Native Windows resolution searches PATH plus PATHEXT, does not require POSIX executable permission bits, and accepts `.exe`/`.com` plus explicit `.js`/`.mjs`/`.cjs` Node entries. Node entries are spawned through the running Node executable, with separate arguments. Their fingerprint covers both entry and runtime metadata.
- `.cmd`/`.bat` commands are refused with an actionable `node.exe` plus JavaScript entry alternative. The module never enables a shell or constructs a shell command string.
- Each output stream retains at most 64 KiB; diagnostic truncation does not imply formatter failure. Nonzero status and signals are preserved.
- POSIX timeout sends one immediate `SIGKILL` to the dedicated process group. This removes the former delayed `SIGKILL` timer that could outlive the parent and promise completion.
- Windows timeout starts absolute `%SystemRoot%/System32/taskkill.exe` with `/PID`, `/T`, and `/F` as separate arguments. Completion waits for both taskkill and the formatter's close event. Taskkill errors/its own 5-second timeout reject rather than report successful cleanup. No delayed formatter-PID kill is scheduled.

## Official API references inspected

- https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows — batch files need a command interpreter; direct shell-free execution is unavailable.
- https://nodejs.org/api/child_process.html#optionsdetached — POSIX detached children receive a process group/session; Windows detached children have different semantics.
- https://nodejs.org/api/child_process.html#event-close — close follows process end and stream closure; exit alone does not establish pipe closure.
- https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill — `/T` includes descendants and `/F` forces termination.

## Executed verification

`bun test test/formatter-process.test.ts --timeout 60000`: 6 pass, 0 fail, 17 assertions on macOS/Bun 1.4.0. The tests use real processes and cover PATH/direct resolution, metadata replacement, literal shell metacharacters and spaces, bounded stdout/stderr, nonzero status, timeout descendants with delayed writes, and spawn failure. The timeout descendant installs a SIGTERM handler and writes only after the deadline; no late write occurred.

`bunx tsc --noEmit`: exit 0.

`bun product/engine/typescript/00_normalize-imports.ts --write <both owned files>` and each file's `06_align-tables.ts --write --json`: exit 0 with parser status `ok`, no refused groups. This is repository source alignment, not public approval promotion.

`git diff --check`: exit 0. Explicit scan for TODO, test.skip/test.only, describe.skip/describe.only in owned files found no matches (`rg` exit 1).

`bun build product/engine/common/formatter-process.ts --target=node --outfile=/tmp/boxbox-first-use.lOogPD/formatter-process.mjs`: exit 0.

`node /tmp/boxbox-first-use.lOogPD/node-process-smoke.mjs`: exit 0 under real Node v22.22.3 on darwin. Output: `{"platform":"darwin","node":"v22.22.3","literalArgs":true,"boundedOutput":true,"descendantTimeout":true}`.

Full outputs: `formatter-process-tests.log`, `formatter-process-types.log`, and `formatter-process-node.log` in this directory. Portable Node bundle and smoke script are present for root's separate native Windows SSH run.

## Acceptance limits

Native Windows execution has not been performed by this worker and is not claimed. Two Windows-specific Bun cases are conditional on `process.platform === "win32"`; they were not counted among the six macOS passes. The portable Node smoke adds Windows PATH/PATHEXT resolution, direct Node entry execution, and batch-shim refusal when actually run on Windows.

The timeout implementation targets the process group/tree started by a conventional formatter. It is not a sandbox for an adversarial formatter that independently detaches processes, nor a Windows Job Object guarantee against orphaned descendants. The existing atomic pipeline remains responsible for refusing original-file replacement after timeout/error. Native Windows parser behavior, atomic replacement, host hook acceptance, and complete installer journeys belong to root integration verification.
