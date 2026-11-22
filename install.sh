#!/bin/bash
# Install the Super Agent plugin pack (3 plugins) into a DSH profile.
# Usage: bash install.sh [profile]   (default profile: web)
# Env: DSH_HOME (default /home/hatch/.dsh-rc5), DSH_BIN (default rc.5 dsh).
set -e
PROFILE="${1:-web}"
DSH_HOME="${DSH_HOME:-/home/hatch/.dsh-rc5}"
DSH_BIN="${DSH_BIN:-/home/hatch/workspace/dsh-test-rc5/node_modules/.bin/dsh}"
PNPM_BIN=/home/hatch/workspace/tools/node_modules/.bin
PACK_DIR="$(cd "$(dirname "$0")" && pwd)"

for plugin in superagent-intervention superagent-takeover superagent-caretaker; do
  echo "=== adding dsh-superagent-$plugin ==="
  DSH_HOME="$DSH_HOME" PATH="$PNPM_BIN:$PATH" "$DSH_BIN" plugin --profile "$PROFILE" add "$PACK_DIR/plugins/$plugin"
done

echo ""
echo "Installed. Restart DSH for the pack to load:"
echo "  bash ~/workspace/dsh-test-rc5/start-dsh-rc5.sh"
