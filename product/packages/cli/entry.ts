#!/usr/bin/env node
import { runCli } from "../../engine/00_cli.ts";

process.exitCode = await runCli(process.argv.slice(2));
