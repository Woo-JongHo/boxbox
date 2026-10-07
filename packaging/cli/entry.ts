#!/usr/bin/env node
import { runCli } from "../../skills/xxx/scripts/cli.ts";

process.exitCode = await runCli(process.argv.slice(2));
