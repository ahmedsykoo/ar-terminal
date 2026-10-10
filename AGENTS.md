# AGENTS.md — AR Terminal

Read this first; it is short on purpose (saves tokens). Principles: `.specify/memory/constitution.md`.

## Roles (two agents)
- **Planner/Reviewer = Claude.** Writes spec → plan → tasks, delegates, reviews the diff, decides. Does not write bulk code.
- **Executor = OpenCode (free model).** Implements exactly one task at a time from `specs/<feature>/tasks.md`. No redesign.

## Workflow (Spec Kit)
1. `/speckit.constitution` (once, already done) → `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`
2. Planner delegates: "implement task T00X only" (OpenCode runs `/speckit.implement` scoped to that task).
3. Executor finishes with a ≤10-line `specs/<feature>/REPORT.md` entry: files changed, commands run, result, doubts.
4. Planner reviews `git diff` (not whole files) + test output; approves or writes a fix task.

## Token rules (both agents)
- Read only the files named in the task. Use `grep`/line ranges, never dump big files (`media/xterm/*`, `package-lock.json`, `*.patch` are huge).
- Don't re-read what is in this file. Don't paste long logs: quote the failing lines only.
- Tasks must be self-contained: files, acceptance check, exact command. Reports stay short.
- Ask one precise question instead of exploring when blocked.

## Repo map
- `src/` extension + shared UI (`src/ui/terminal-ui.ts`), tests `src/*.test.ts` (vitest)
- `app/` Electron desktop (Windows first) · `android/` WebView app · `termux/` browser terminal (`arterm`)
- `termux-ar/` Termux patch (renderer) · `.github/workflows/` CI builds

## Commands
- Test: `npm test` · Types: `npx tsc --noEmit -p .`
- Regenerate pages after editing `src/ui/terminal-ui.ts`: `android/build-assets.sh`, `termux/gen-web.sh`
- Termux patch layout logic test lives in the patch's `RtlRunLayout`; CI builds the APK.
- Never push to `main`; work on the feature branch; PR is already open.
