# AR Terminal for Termux (Android)

Runs your real shell (`pwsh` if you have it, else `$SHELL`) inside Termux and shows it in the
phone browser with correct Arabic — connected letters, natural direction. Anything you run inside it
(`pwsh`, `claude`, `vim`, `ssh`) works like a normal terminal.

```bash
# inside Termux
pkg install -y git
git clone -b claude/admiring-newton-xmnkva https://github.com/ahmedsykoo/ar-terminal
bash ar-terminal/termux/install.sh
arterm            # prints a private URL and opens it (or open it in your browser)
```

- Options: `arterm --shell bash`, `--port 9000`, `--cwd ~/project`, `--no-open`.
- Binds to `127.0.0.1` only, with a random token in the URL (and an HttpOnly cookie) — nothing is exposed to the network.
- Needs only Python (standard library). Run `termux-open-url` support via `pkg install termux-api` (optional).
- After changing `src/ui/terminal-ui.ts`, regenerate the page with `termux/gen-web.sh`.

## Claude Code on Android (verified path)

Claude Code has **no native Android build** (`linux-arm64-android` is not published), so it can't run directly in Termux.
Run it inside Ubuntu (proot) instead, where it is `linux-arm64`:

```bash
pkg install -y proot-distro
proot-distro install ubuntu
proot-distro login ubuntu
# inside Ubuntu:
apt update && apt install -y nodejs npm
npm i -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code
claude
```

Arabic renders correctly there when you use the **AR Termux** app ([`ahmedsykoo/ar-termux`](https://github.com/ahmedsykoo/ar-termux)), because drawing happens in the app,
not inside Linux.

> PowerShell is **not** in Termux's main repo. Install `pwsh` inside the Ubuntu proot if you need it.
