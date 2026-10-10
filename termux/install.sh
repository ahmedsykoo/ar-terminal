#!/data/data/com.termux/files/usr/bin/bash
# One-time setup inside Termux. Usage: bash termux/install.sh
set -e
pkg install -y python git
DIR="$(cd "$(dirname "$0")" && pwd)"
printf '#!/data/data/com.termux/files/usr/bin/bash\nexec python "%s/ar-terminal-web.py" "$@"\n' "$DIR" > "$PREFIX/bin/arterm"
chmod +x "$PREFIX/bin/arterm"
echo "Done. Run:  arterm"
echo "Optional (Claude Code):  pkg install nodejs && npm config set allow-scripts=@anthropic-ai/claude-code --location=user && npm i -g @anthropic-ai/claude-code"
