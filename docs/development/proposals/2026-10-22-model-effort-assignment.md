# Model and effort assignment per host

Status: proposal (2026-10-22), tracked by [issue 020](../issue-library/records/BBX-20261022-020-model-effort-assignment.json).
Nothing here is implemented; every model name below is a hypothesis until the evaluation in
[Choosing the values](#choosing-the-values) selects it.

## Gap and scope

The shipped plugin never chooses a model. The Claude `readability-inspector` sets `effort: medium` and no `model`, so it
inherits the caller. The Codex inspector (`development/codex/readability-inspector.toml`) pins `gpt-5.6-terra` with
`medium`, but it is a development definition: the Codex plugin manifest declares `skills` only and no agents. The
engine is deterministic and spends no tokens, so the whole token cost of BoxBox sits in the few places where an agent
judges. This proposal names those places, assigns each a model and effort per host (Claude Code, Codex), and defines
how the values are stored, generated and chosen.

Out of scope: choosing the model of the user's own session, publication, new product surfaces and the `-monitor` page
(see [measuring](#order)).

## Where AI judgment enters

From the Write/Refactor procedure in `product/plugin/skills/boxbox/SKILL.md` and the inspector definitions:

| Role | What the agent judges | Engine alternative | Assignable by the plugin |
| --- | --- | --- | --- |
| `author` | Write 2-3: which values share columns, how to compose each row, behavior preservation | None; this is the product's value | No; it is the user's session model |
| `inspector` | One file, read-only: execution flow, same-role candidates versus over-alignment risks | Partly: `check` and `guide` already supply groups and approval | Yes; a subagent definition |
| `reconcile` | Write 5: every requested boundary has an axis in the final `check` | Yes: the engine can list unverified boundaries | Becomes engine output; no model |
| `candidates` | Write 2: column-set candidates for a group of same-role values | Yes: `guide --authoring` can return candidates | Becomes engine output; no model |

Align, Check and the hooks run no model. Moving `reconcile` and `candidates` into the engine is a prerequisite: it removes
tokens outright and makes the remaining judgment smaller, which lets a cheaper model pass the evaluation.

## Principles

1. **Never override the author.** Quality of row design is the product; a plugin must not lower the model the user chose.
2. **Assign only what the plugin owns.** Subagent definitions are owned by the plugin; the session is not.
3. **Cheapest passing setting.** Start from the lightest candidate and move up only on measured failure, following the
   ladder and signals in [model-eval.md](../research/model-eval.md) section 7. Top-tier models are not used.
4. **Effort is compared inside one model only.** Effort names do not mean the same thing across providers.
5. **One source of truth, generated into both hosts.** No hand-edited duplicate values.
6. **Honest provenance.** A value ships with the evaluation that selected it, or is labelled an unevaluated default.

## Host capability facts

Measured on 2026-10-22; runtime effect is not yet measured.

| Fact | Claude Code | Codex |
| --- | --- | --- |
| Plugin ships subagents | Yes (`agents/*.md`) | No: the manifest has `skills` only |
| Model and effort in subagent definition | `model:` and `effort:` frontmatter | `model` and `model_reasoning_effort` in `~/.codex/agents/*.toml` |
| Model and effort in skill frontmatter | `claude plugin validate --strict` accepted `model:` and `effort:` in `SKILL.md` and the agent file | Not applicable |
| Where the user's setting lives | `~/.claude/settings.json` | `~/.codex/config.toml` |

Consequences: Claude values can ship inside the plugin. Codex values cannot ship through the plugin today; the only
options are documentation (a recommended agent file the user copies) or an installer step that writes a global
`~/.codex/agents/` file. The second changes user-global configuration and needs an explicit decision.

## Prior art: Gajae Code

Read from the open-source repository `Yeachan-Heo/gajae-code` (clone `e9179a1`, 2026-10-16). It is its own agent runtime,
not a Codex plugin, so it shows a storage model rather than a way to configure Codex.

| Question | Finding |
| --- | --- |
| Where is effort stored? | In its own files, never in Codex's: `~/.gjc/agent/config.yml` (`modelRoles`, `task.agentModelOverrides`) and `~/.gjc/agent/models.yml` (`profiles:`) |
| Shape | A selector string `provider/modelId[:effort]` per role; effort suffix `off\|minimal\|low\|medium\|high\|xhigh`, and `max` for some models |
| Roles | `default` plus `executor`, `architect`, `planner`, `critic`; a role may list an ordered array, first entry primary, the rest fallbacks |
| Presets | Shipped as code (`model-preset-registry.ts`), for example `codex-eco`, `codex-medium`, `codex-pro` mapping each role to a model and effort; local config always wins and a registry refresh never overwrites it |
| Effort support | Declared per model; a model that lacks an effort control gets the parameter omitted, not guessed |
| Codex's own config | `model_reasoning_effort` appears nowhere in the repository. It sends `reasoning_effort` in provider requests and edits only `~/.codex/hooks.json`, as two managed entries |

What to take:

1. **Selector strings with an effort suffix** (`model:effort`) are a compact, readable cell and map directly onto the
   `{ model, effort }` pair in this proposal.
2. **Per-role tiers as named presets**, with local override winning, fit the evaluation outcome: the evaluation yields a
   tier, not a single model.
3. **Fail closed on unsupported effort.** Store effort only for models that declare it; Haiku has none.
4. **Managed-entry merge is the precedent for decision 1.** Writing a Codex file is acceptable when BoxBox adds and
   removes only entries it owns and leaves the rest untouched; whole-file replacement is not.

What not to take: its role set (it serves a general orchestration runtime) and its direct model switching, which
BoxBox cannot do inside a host session.

## Single source and generation

Implemented in `product/models.json` (2026-10-22):

```json
{
	"schemaVersion": 1,
	"capabilities": { "sonnet": ["low", "medium", "high"], "gpt-5.6-terra": ["low", "medium", "high"] },
	"roles": {
		"inspector": {
			"claude": { "model": "sonnet", "effort": "medium", "selectedBy": "unevaluated-default" },
			"codex" : { "model": "gpt-5.6-terra", "effort": "medium", "selectedBy": "unevaluated-default" }
		}
	}
}
```

- `capabilities` lists the efforts each model supports, and an empty list for a model without effort control. A role may
  use only a listed model and an effort from its list; a model that takes effort must be given one. The list grows only
  with evidence, so an unlisted model or effort is refused rather than guessed.
- `development/tools/model-assignments.ts` validates the file and stamps the host definitions. `bun run sync:plugin` writes
  `model` and `effort` into `plugin/agents/readability-inspector.md` and stamps `development/agents/readability-inspector.md`
  and `development/codex/readability-inspector.toml` in place, so the hosts cannot drift. An assignment without effort
  removes the effort line. `sync:plugin --check` reports any file that differs.
- The product template `product/plugin/agents/readability-inspector.md` carries no model or effort.
- `test/model-assignments.test.ts` pins validation (the `author` role and unsupported effort are refused), stamping,
  agreement of every generated file with the source, and that the Codex manifest declares no agents.
- `selectedBy` holds `unevaluated-default` or the evaluation record that chose the value.
- A fallback ladder (a role retried one rung up) is deferred until escalation is implemented; it needs a consumer first.

Shipping effect: the Claude inspector now pins `sonnet` instead of inheriting the caller. That changes the shipped plugin
content, so it belongs to the next candidate and a version bump.

## Choosing the values

Reuse the protocol in [eval-protocol.md](../research/eval-protocol.md) instead of inventing one. The ground truth is the
engine: for each file, the inspector's classification is compared with the deterministic `check` and approval result, so
scoring needs no model and no human.

| Axis | Candidates |
| --- | --- |
| Claude | `claude-haiku-4-5` (no effort control), `claude-sonnet-5-5` at `low` and `medium` |
| Codex | `gpt-6-luna` at `low` and `medium`, `gpt-5.6-terra` at `medium` as the incumbent |
| Task | The `inspector` role on a fixed set of TypeScript and Python files with known engine outcomes |
| Metrics | Agreement with the engine (Cohen's kappa, per-class recall for rare verdicts), cost per completed file, escalation rate |
| Rule | Pick the cheapest setting that is not inferior to the incumbent by the agreed margin |

The price table in `model-eval.md` is dated 2026-09-30 and has no `claude-sonnet-5-5` row. Update it before comparing costs,
and do not infer prices.

## Baseline measured on the inherited model

Four fresh sessions on native Windows (Claude Code 2.1.280, boxbox 0.2.5, the machine default `claude-opus-5-5` at medium effort;
[evidence](../issue-library/evidence/inspector-baseline-sessions.txt)):

| Request | Turns | Output tokens | Cache-read tokens | Printed cost (USD) |
| --- | ---: | ---: | ---: | ---: |
| BoxBox Check on two files | 3 | 1,519 | 89,552 | 0.3171 |
| BoxBox Write: append one line | 3 | 1,664 | 92,888 | 0.3074 |
| BoxBox align one file | 5 | 2,069 | 184,460 | 0.3432 |
| Inspector agent on one file | 6 (2 main, 4 subagent) | 3,026 (1,787 subagent) | 151,959 (104,170 subagent) | 0.5120 |

The inspector request costs about 0.2 USD more than a check-only run, and its subagent is the larger part of it. A
choice of model for the inspector acts on exactly that part. These are baselines on one model: no alternative has been run and
correctness is not scored, so they do not yet say which model is enough.

## Order

1. **Engine absorbs judgment (done 2026-10-22).** `guide --authoring` returns `columnSets` and `axisNotes` for TypeScript;
   `check --expect-axis` returns `axisExpectation` (`covered`, `missing`, `unknown`). The authoring response grows from
   2364 to about 8.3 KB, so the saving is real only if agents stop reading the 32 KB contract; step 2 must measure it.
2. **Measure (tool done 2026-10-22).** `development/tools/session-usage.ts` reads a session record (`usage` numbers, model, effort,
   tool names and sizes; never message text; usage counted once per message id) and splits turns by BoxBox step. It is
   also the data source of the proposed `-monitor` page. Two real sessions show hook text is negligible and neither ran the
   inspector, so the evaluation needs sessions that exercise guide, check and the inspector.
3. **Evaluate.** Run the table above; record the evidence under `docs/development/reviews/`.
4. **Stamp.** Add `product/models.json`, generation and contract test; ship Claude values.
5. **Document.** Codex recommendation and any approved installer step; update the three root READMEs together.

Steps 1 and 2 do not depend on any decision below and can start immediately.

## Decisions needed

1. May the installer write a Codex agent file under `~/.codex/agents/`? If yes, it follows the managed-entry rule from
   the prior art: BoxBox owns one clearly named file, creates and removes only that file and never edits others. Without
   it, Codex users get a documented recommendation only.
2. Confirm that the plugin never sets a model for the `author` role, including through skill frontmatter.
3. Confirm the pass criterion (non-inferiority margin and the minimum per-class recall) before the evaluation runs.
4. Does the inspector ever run on Haiku, or is Sonnet the floor? Haiku has no effort control, so its cost advantage is
   largest and its judgment risk is highest.
