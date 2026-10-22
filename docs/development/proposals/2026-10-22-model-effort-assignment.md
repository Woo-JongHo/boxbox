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

Add `product/models.json`, stamped like the version:

```json
{
	"roles": {
		"inspector": {
			"claude": { "model": "sonnet", "effort": "medium", "selectedBy": "unevaluated-default" },
			"codex" : { "model": "gpt-5.6-terra", "effort": "medium", "selectedBy": "unevaluated-default" }
		}
	},
	"ladder": {
		"claude": ["claude-haiku-4-5", "claude-sonnet-5-5"],
		"codex" : ["gpt-6-luna:low", "gpt-6-luna:medium", "gpt-6-sol:low"]
	}
}
```

- `bun run sync:plugin` stamps `model` and `effort` into `plugin/agents/readability-inspector.md` and the Codex agent file
  from this source; templates under `product/plugin/` carry placeholders.
- `test/plugin-contract.test.ts` pins that generated frontmatter equals the source, and that no role names `author`.
- `selectedBy` holds `unevaluated-default` or the evaluation record that chose the value.
- `development/codex/readability-inspector.toml` is generated from the same source so the two cannot drift.
- Escalation (a role retried one rung up) is documented for the agent in `SKILL.md`; the ladder lives in this file.

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

## Order

1. **Engine absorbs judgment.** `guide --authoring` returns column-set candidates; `check` returns unverified requested
   boundaries. Tests per the existing result-JSON contract.
2. **Measure.** Per-step token recording from session records (`usage` numbers only, never message content), which is also
   the data source of the proposed `-monitor` page.
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
