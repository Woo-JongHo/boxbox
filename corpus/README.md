# Corpus

Real-world sources the plugin is measured and judged against (design §6, plan M1.5). The manifest pins every
source by repository, commit SHA, license and paths, so a run is reproducible: the same tables are detected and
the same verdicts apply, regardless of when the source is fetched.

- `manifest.json` — the committed pin list. Only permissively licensed public repositories (MIT, Apache-2.0,
  BSD-3-Clause) belong here.
- `local.json` — **optional, gitignored, never committed.** The same schema as `manifest.json`; use it for
  private repositories you want in the corpus on this machine only. The fetcher merges both files and refuses
  duplicate ids. Example:

  ```json
  {
  	"schemaVersion": 1,
  	"sources": [
  		{
  			"id": "my-project",
  			"language": "typescript",
  			"repository": "mycompany/my-project",
  			"commit": "<40-hex commit>",
  			"license": "UNLICENSED",
  			"paths": ["src"]
  		}
  	]
  }
  ```

## Fetch

```bash
bun scripts/corpus-fetch.ts
```

Materializes every source as a shallow working tree at the pinned commit under `~/.cache/xxx/corpus/<id>`.
Re-running is idempotent — a clone already at the pinned commit is left untouched. Cloned source lives only in
the cache and is never committed to this repository; derived fixtures must be minimized and use synthetic
identifiers (design §5.2).
