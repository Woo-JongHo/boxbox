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

# The AST checkers (scripts/typescript/*.ts) resolve typescript from this repository's node_modules.
install_dependencies() {
	echo "Installing dependencies: $PLUGIN_ROOT (typescript@7)"
	if command -v bun >/dev/null 2>&1; then (cd "$PLUGIN_ROOT" && bun install);
	else (cd "$PLUGIN_ROOT" && npm install); fi
}

# place <link path> <source path> — skips existing non-symlink entries because they may be user-owned.
place() {
	local link="$1" source="$2"
	local marker="${link}.boxbox-managed"
	if [ "$MODE" = "uninstall" ]; then
		if [ -L "$link" ]; then
			rm -f "$link"
			printf 'Removed %s\n' "$link"
		elif [ -e "$marker" ]; then
			rm -rf "$link"
			rm -f "$marker"
			printf 'Removed %s\n' "$link"
		elif [ -e "$link" ]; then
			printf 'Skipped %s — no marker showing the plugin created it.\n' "$link"
		fi
		return 0
	fi
	if [ -e "$link" ] && [ ! -L "$link" ]; then
		echo "Skipped $link — an existing entry that is not a symlink is present. Clean it up manually, then rerun."
		return 0
	fi
	mkdir -p "$(dirname "$link")"
	case "$MODE" in
		copy)      rm -rf "$link" && cp -RL "$source" "$link" && : > "$marker" && echo "Copied $(basename "$source") -> $link" ;;
		link)      ln -sfn "$source" "$link" && echo "Linked $link -> $source" ;;
	esac
}

if [ "$MODE" != "uninstall" ] && [ "$SKIP_DEPS" != "true" ]; then install_dependencies; fi

for target in "${TARGETS[@]}"; do
	case "$target" in
		claude)
			place "$INSTALL_HOME/.claude/skills/boxbox" "$SKILL_DIR"
			place "$INSTALL_HOME/.claude/agents/readability-inspector.md" "$PLUGIN_ROOT/development/agents/readability-inspector.md"
			echo "Note: for a Claude Code marketplace install, run /plugin marketplace add <this repository>, then /plugin install boxbox@boxbox-plugins"
			;;
		zcode)
			place "$INSTALL_HOME/.agents/skills/boxbox" "$SKILL_DIR"
			echo "Note: ZCode recognizes the .claude-plugin/ compatible manifests, so adding it as a marketplace also works"
			;;
		codex)
			place "$INSTALL_HOME/.codex/skills/boxbox" "$SKILL_DIR"
			place "$INSTALL_HOME/.codex/agents/readability-inspector.toml" "$PLUGIN_ROOT/development/codex/readability-inspector.toml"
			;;
		pi)
			place "$PWD/.pi/skills/boxbox" "$SKILL_DIR"
			echo "Note: pi and oh-my-pi auto-discover skills in the current project's .pi/skills/. For a package install use pi install git:github.com/<owner>/<repo>"
			;;
	esac
done
echo "Done. Invoke the boxbox skill in each agent to confirm it is discovered."
