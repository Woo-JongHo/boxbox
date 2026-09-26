#!/usr/bin/env bash
# woo-readability 플러그인 설치 — 대상 에이전트의 스킬·에이전트 디렉터리를 이 저장소에 연결한다.
# 사용법: ./install.sh [claude|zcode|codex|pi ...] [--copy] [--uninstall]
# 기본은 심볼릭 링크여서 이 저장소를 갱신하면 모든 에이전트에 즉시 반영된다.
set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$PLUGIN_ROOT/skills/woo-code-readability"
MODE="link"
TARGETS=()
for argument in "$@"; do
	case "$argument" in
		--copy)      MODE="copy" ;;
		--uninstall) MODE="uninstall" ;;
		claude|zcode|codex|pi) TARGETS+=("$argument") ;;
		*) echo "알 수 없는 인자: $argument"; echo "사용법: $0 [claude|zcode|codex|pi ...] [--copy] [--uninstall]"; exit 1 ;;
	esac
done
if [ "${#TARGETS[@]}" -eq 0 ]; then
	echo "사용법: $0 [claude|zcode|codex|pi ...] [--copy] [--uninstall]"
	exit 1
fi

# AST 검사기(scripts/typescript/*.ts)는 이 저장소의 node_modules에서 typescript를 찾는다.
install_dependencies() {
	echo "의존성 설치: $PLUGIN_ROOT (typescript@7)"
	if command -v bun >/dev/null 2>&1; then (cd "$PLUGIN_ROOT" && bun install);
	else (cd "$PLUGIN_ROOT" && npm install); fi
}

# place <연결 경로> <원본 경로> — 심볼릭 링크가 아닌 기존 항목은 사용자 소유일 수 있으므로 건너뛴다.
place() {
	local link="$1" source="$2"
	if [ -e "$link" ] && [ ! -L "$link" ]; then
		echo "건너뜀 $link — 심볼릭 링크가 아닌 기존 항목이 있다. 수동으로 정리한 뒤 다시 실행한다."
		return 0
	fi
	mkdir -p "$(dirname "$link")"
	case "$MODE" in
		uninstall) rm -f "$link" && echo "제거 $link" ;;
		copy)      rm -rf "$link" && cp -R "$source" "$link" && echo "복사 $(basename "$source") -> $link" ;;
		link)      ln -sfn "$source" "$link" && echo "연결 $link -> $source" ;;
	esac
}

if [ "$MODE" != "uninstall" ]; then install_dependencies; fi

for target in "${TARGETS[@]}"; do
	case "$target" in
		claude)
			place "$HOME/.claude/skills/woo-code-readability" "$SKILL_DIR"
			place "$HOME/.claude/agents/readability-inspector.md" "$PLUGIN_ROOT/agents/readability-inspector.md"
			echo "참고: Claude Code 마켓플레이스 설치는 /plugin marketplace add <이 저장소> 후 /plugin install woo-readability@woo-plugins"
			;;
		zcode)
			place "$HOME/.agents/skills/woo-code-readability" "$SKILL_DIR"
			echo "참고: ZCode는 .claude-plugin/ 호환 매니페스트를 인식하므로 마켓플레이스 추가도 가능하다"
			;;
		codex)
			place "$HOME/.codex/skills/woo-code-readability" "$SKILL_DIR"
			place "$HOME/.codex/agents/readability-inspector.toml" "$PLUGIN_ROOT/codex/readability-inspector.toml"
			;;
		pi)
			place "$PWD/.pi/skills/woo-code-readability" "$SKILL_DIR"
			echo "참고: pi·oh-my-pi는 현재 프로젝트 .pi/skills/에서 스킬을 자동 발견한다. 패키지 설치는 pi install git:github.com/<owner>/<repo>"
			;;
	esac
done
echo "완료. 각 에이전트에서 woo-code-readability 스킬을 호출해 발견 여부를 확인한다."
