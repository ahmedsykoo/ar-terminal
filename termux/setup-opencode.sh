#!/usr/bin/env bash
# Run INSIDE the Ubuntu proot (proot-distro login ubuntu). Installs OpenCode + the AR Terminal repo.
set -euo pipefail
BRANCH="${BRANCH:-claude/admiring-newton-xmnkva}"
REPO="${REPO:-https://github.com/ahmedsykoo/ar-terminal}"

echo "== 1/4 packages"
apt-get update -y
apt-get install -y git curl ca-certificates nodejs npm

echo "== 2/4 OpenCode"
if ! command -v opencode >/dev/null 2>&1; then
  npm i -g opencode-ai@latest || npm i -g @opencode/cli
fi
opencode --version

echo "== 3/4 project"
if [ ! -d "$HOME/ar-terminal/.git" ]; then
  git clone -b "$BRANCH" "$REPO" "$HOME/ar-terminal"
else
  git -C "$HOME/ar-terminal" pull --ff-only
fi

echo "== 4/4 done"
cat <<MSG
Next:
  cd ~/ar-terminal
  opencode            # pick a free model from the model list (/models)
  In OpenCode try:    /speckit.specify <feature description>
MSG
