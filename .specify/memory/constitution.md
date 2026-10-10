# AR Terminal Constitution

## Core Principles

### I. Correct Arabic first
Arabic/Hebrew/Persian/Urdu must render connected, in the right direction, never reversed or letter-by-letter.
Every UI change is checked against: pure Arabic line, mixed Arabic+Latin line, table/box-drawing row, input echo.

### II. One shared renderer
The terminal page lives in `src/ui/terminal-ui.ts` and is reused by VS Code, Electron (`app/`), Android WebView
(`android/`) and the browser server (`termux/`). Never fork it per platform; add a host adapter instead.

### III. Real shell, no emulation
We run the user's real shell (PowerShell/bash/...) on a PTY. We only change how output is drawn.

### IV. Patch, don't fork (Termux)
AR Termux is `termux-ar/patches/*.patch` applied to a pinned upstream commit (`BASE_COMMIT`). Keep patches minimal.

### V. Verify before claiming
Run `npm test` and `npx tsc --noEmit -p .`; for UI changes render in Chromium (Playwright) and look at the screenshot.
Android/Windows behaviour that can't be run here must be reported as untested, never as working.

### VI. Small, reviewable changes
One task = one focused diff. No unrelated refactors. No secrets in the repo.

## Governance
This constitution wins over personal preference. Amend it in a dedicated commit with the reason.

**Version**: 1.0.0 | **Ratified**: 2026-10-10 | **Last Amended**: 2026-10-10
