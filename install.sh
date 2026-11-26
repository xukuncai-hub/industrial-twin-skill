#!/usr/bin/env bash
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGETS=(
  "$HOME/.gemini/config/skills/industrial-twin-skill"
  "$HOME/.agents/skills/industrial-twin-skill"
  "$HOME/.claude/skills/industrial-twin-skill"
)

echo "============================================================"
echo "  Industrial Twin Skill - One-Click Installer (macOS/Linux)"
echo "============================================================"

for T in "${TARGETS[@]}"; do
  echo "[Install] $T"
  mkdir -p "$T"
  cp -f "$SRC/SKILL.md" "$T/SKILL.md"
  rm -rf "$T/references" "$T/scripts" "$T/assets"
  cp -R "$SRC/references" "$T/references"
  cp -R "$SRC/scripts" "$T/scripts"
  cp -R "$SRC/assets" "$T/assets"
done

echo ""
echo "[OK] Installed! Start a new conversation in your AI IDE to use industrial-twin-skill."
