#!/usr/bin/env bash
# boxbox plugin installer — links each target agent's skill and agent directories to this repository.
# Usage: ./development/install.sh [claude|zcode|codex|pi ...] [--copy] [--uninstall] [--skip-deps]
# Symlinks by default, so updates to this repository reach every agent immediately.
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$PLUGIN_ROOT/development/skills/boxbox"
MODE="link"
INSTALL_HOME="${BOXBOX_INSTALL_HOME:-$HOME}"
SKIP_DEPS="false"
TARGETS=()
for argument in "$@"; do
	case "$argument" in
		--copy)      MODE="copy" ;;
		--uninstall) MODE="uninstall" ;;
		--skip-deps) SKIP_DEPS="true" ;;
		claude|zcode|codex|pi) TARGETS+=("$argument") ;;
		*) echo "Unknown argument: $argument"; echo "Usage: $0 [claude|zcode|codex|pi ...] [--copy] [--uninstall] [--skip-deps]"; exit 1 ;;
	esac
done
if [ "${#TARGETS[@]}" -eq 0 ]; then
	echo "Usage: $0 [claude|zcode|codex|pi ...] [--copy] [--uninstall] [--skip-deps]"
	exit 1
fi

# Development skill runtimes resolve the pinned packages from this repository's node_modules.
install_dependencies() {
	echo "Installing pinned dependencies: $PLUGIN_ROOT"
	if command -v bun >/dev/null 2>&1; then (cd "$PLUGIN_ROOT" && bun install);
	else (cd "$PLUGIN_ROOT" && npm install); fi
}

# Prints the root dependency names after verifying that their installed versions match package.json.
dependency_names() {
	node -e '
		const fs = require("node:fs");
		const path = require("node:path");
		const root = process.argv[1];
		const manifest = require(path.join(root, "package.json"));
		for (const [name, expected] of Object.entries(manifest.dependencies ?? {})) {
			const installed = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8"));
			if (installed.version !== expected) throw new Error(`${name}: expected ${expected}, found ${installed.version}`);
			console.log(name);
		}
	' "$PLUGIN_ROOT"
}

preflight_skill_dependencies() {
	DEPENDENCY_NAMES="$(dependency_names)" || {
		echo "Cannot create a self-contained copy: pinned runtime dependencies are not installed. Rerun without --skip-deps."
		return 1
	}
	local typescript_platform="$PLUGIN_ROOT/node_modules/@typescript"
	if ! compgen -G "$typescript_platform/typescript-*" >/dev/null; then
		echo "Cannot create a self-contained copy: the TypeScript platform package is not installed. Rerun without --skip-deps."
		return 1
	fi
}

file_hash() {
	shasum -a 256 "$1" | cut -d " " -f 1
}

managed_copy() {
	local link="$1" marker="${1}.boxbox-managed"
	if [ -d "$link" ] && [ ! -L "$link" ] && [ -f "$link/.boxbox-managed" ] && [ -f "$marker" ]; then
		[ "$(<"$link/.boxbox-managed")" = "$(<"$marker")" ] && [[ "$(<"$marker")" == directory:* ]]
		return
	fi
	if [ -f "$link" ] && [ ! -L "$link" ] && [ -f "$marker" ]; then
		local expected="$(<"$marker")"
		[[ "$expected" == file:* ]] && [ "${expected#file:}" = "$(file_hash "$link")" ]
		return
	fi
	return 1
}

owned_link() {
	[ -L "$1" ] && [ "$(readlink "$1")" = "$2" ]
}

# place <link path> <source path> — replaces only entries whose ownership identity still matches.
place() {
	local link="$1" source="$2"
	local marker="${link}.boxbox-managed"
	PLACED="false"
	if [ "$MODE" = "uninstall" ]; then
		if owned_link "$link" "$source"; then
			rm -f "$link"
			printf 'Removed %s\n' "$link"
		elif managed_copy "$link"; then
			rm -rf "$link"
			rm -f "$marker"
			printf 'Removed %s\n' "$link"
		elif [ -e "$link" ] || [ -L "$link" ]; then
			printf 'Skipped %s — ownership identity does not match this installation.\n' "$link"
		fi
		return 0
	fi
	if [ -e "$link" ] || [ -L "$link" ]; then
		if owned_link "$link" "$source" || managed_copy "$link"; then
			rm -rf "$link"
			rm -f "$marker"
		else
			if [ -L "$link" ]; then
				echo "Skipped $link — symlink ownership identity does not match this installation."
			else
				echo "Skipped $link — an existing entry that is not a symlink is present and its ownership identity does not match this installation."
			fi
			return 0
		fi
	fi
	mkdir -p "$(dirname "$link")"
	case "$MODE" in
		copy)
			cp -RL "$source" "$link"
			if [ -d "$link" ]; then
				local identity="directory:$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
				printf '%s\n' "$identity" > "$link/.boxbox-managed"
				printf '%s\n' "$identity" > "$marker"
			else
				printf 'file:%s\n' "$(file_hash "$link")" > "$marker"
			fi
			PLACED="true"
			echo "Copied $(basename "$source") -> $link"
			;;
		link)      ln -sfn "$source" "$link" && PLACED="true" && echo "Linked $link -> $source" ;;
	esac
}

# A copied development skill runs outside this repository, so materialize its pinned runtime dependencies locally.
copy_skill_dependencies() {
	local skill="$1"
	local typescript_platform="$PLUGIN_ROOT/node_modules/@typescript"
	local dependency
	for dependency in $DEPENDENCY_NAMES; do
		mkdir -p "$(dirname "$skill/node_modules/$dependency")"
		cp -RL "$PLUGIN_ROOT/node_modules/$dependency" "$skill/node_modules/$dependency"
	done
	mkdir -p "$skill/node_modules/@typescript"
	cp -RL "$typescript_platform"/typescript-* "$skill/node_modules/@typescript/"
}

place_skill() {
	local target="$1"
	place "$target" "$SKILL_DIR"
	if [ "$MODE" = "copy" ] && [ "$PLACED" = "true" ]; then copy_skill_dependencies "$target"; fi
}

if [ "$MODE" != "uninstall" ] && [ "$SKIP_DEPS" != "true" ]; then install_dependencies; fi
if [ "$MODE" = "copy" ]; then preflight_skill_dependencies; fi

for target in "${TARGETS[@]}"; do
	case "$target" in
		claude)
			place_skill "$INSTALL_HOME/.claude/skills/boxbox"
			place "$INSTALL_HOME/.claude/agents/readability-inspector.md" "$PLUGIN_ROOT/development/agents/readability-inspector.md"
			echo "Note: for a Claude Code marketplace install, run /plugin marketplace add <this repository>, then /plugin install boxbox@boxbox-plugins"
			;;
		zcode)
			place_skill "$INSTALL_HOME/.agents/skills/boxbox"
			echo "Note: ZCode recognizes the .claude-plugin/ compatible manifests, so adding it as a marketplace also works"
			;;
		codex)
			place_skill "$INSTALL_HOME/.codex/skills/boxbox"
			place "$INSTALL_HOME/.codex/agents/readability-inspector.toml" "$PLUGIN_ROOT/development/codex/readability-inspector.toml"
			;;
		pi)
			place_skill "$PWD/.pi/skills/boxbox"
			echo "Note: pi and oh-my-pi auto-discover skills in the current project's .pi/skills/. For a package install use pi install git:github.com/<owner>/<repo>"
			;;
	esac
done
echo "Done. Invoke the boxbox skill in each agent to confirm it is discovered."
