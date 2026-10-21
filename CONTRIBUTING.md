# Contributing

Thanks for looking at this project. It aligns code into spreadsheet-style
tables: rows with the same role get the same minimal structure, and their
syntax boundaries line up into minimum-width columns.

## The non-negotiables

- **A row the engine cannot decompose losslessly is never rewritten.**
  Refusals are a feature, not a failure.
- **Only human-approved rules are applied automatically.** Every automatic
  fix needs an approved convention, a matching decision, examples and
  counterexamples whose document hashes pin the approval. Candidate data is
  never guidance.
- **Every fix passes the full gate or nothing is written:** optional configured
  formatter, approval proof, re-parse check, and a two-run byte fixed point,
  replaced atomically.
- Content preservation, idempotence, and minimum width are property-tested
  for every aligner. New rules need all three plus a positive example and a
  forbidden-shape counterexample.

## Development

```bash
bun install        # pins typescript@7 used by the engine
bun run test       # full suite (toolchain integration tests included)
bun run check      # test + tsc --noEmit + development/install.sh syntax, same as CI
bun run pack:cli   # build the public engine tarball into dist/
```

The runtime is Bun for development; the shipped engine runs on Node 22.22.3+.
TypeScript code in this repository follows the project's own rules — run the
relevant aligner on files you change.

The issue/PR/candidate workflow is documented in [CI operation](docs/development/cicd.md).

## Proposing a rule

1. Open an issue with the table kind, the languages, real-world frequency
   evidence, a positive example, and a forbidden-shape counterexample.
2. The maintainers record a candidate under `docs/development/candidates/` with before /
   after text, content hashes, and the exact lookup key.
3. A human approval (convention + decision + examples + decision document)
   promotes it to `product/rules/presets/recommended/`. Until then the engine
   may suggest but never write.

## Reporting bugs

Include the file snippet (or a minimal reproduction), the `check --json`
output, and the engine version. If a write happened that should not have,
that is a safety bug — please say so loudly in the title.

## License

By contributing you agree that your contributions are licensed under the
MIT License.

The four bundled synthetic examples have their separately recorded CC0-1.0 license. The existing MIT LICENSE is retained from GitHub main; installer candidates still use UNLICENSED preview metadata, and this candidate pipeline does not authorize publication.
