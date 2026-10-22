BoxBox 0.2.4 CI release candidate

Candidate workflow: https://github.com/Woo-JongHo/rowgrid/actions/runs/39637622755
Source commit: 35b61780ae122744f39d9cb0b935db5f8bccd14b (clean CI checkout)
Archive: boxbox-plugin-0.2.4.tgz
SHA-256: bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be

The workflow verified the source on Linux and macOS (653 tests passed on each), built this archive once, and passed engine-only install/doctor/preview/apply/recheck/idempotence and safe-refusal smoke journeys using this exact archive on Linux, macOS and Windows. See the included candidate.json and smoke evidence.

This is a candidate, not a public registry release. New TS/Python/JSON/YAML write rules and example licenses, release-package licensing and native Claude/current-Windows hook acceptance remain open. CI smoke does not test host registration or hook delivery. The previous local 2b43d24e candidate and its native evidence are retained separately; its compressed archive differs, although comparison found byte-identical decompressed engine tar content and other installer files.

This directory is delivery only. No live Codex/Claude profile, plugin trust, credentials, or existing candidate was changed by this delivery.
