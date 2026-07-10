# Orchestrator — Delegation Detail (lazy-loaded)

Bind this to the parent Pi session only, on delegation/routing/review triggers. Not always-on; loaded on demand from `assets/orchestrator.md`'s `## Work Routing Ladder`, `## Delegation Rules`, `## Language Boundary`, and `## 4R Review Triggers` pointers.

## Language Boundary — subagent-facing English + exceptions

Subagent-facing prompts should be written in English by default, even when the user speaks Spanish. Translate the user's request into concise English before delegation. This keeps token usage lower and gives built-in/project subagents a consistent operating language without changing the user-facing persona.

Exceptions:

- Preserve exact user quotes, UI copy, error messages, filenames, commands, and domain terms in their original language when they are evidence.
- Ask a subagent to produce Spanish only when its output is intended to be pasted directly to the user, a PR/comment/reply in Spanish, or Spanish-language product/documentation text.
- SDD/OpenSpec artifact content may follow the project's established language, but phase task instructions to subagents should still be English.

## Work Routing Ladder

Route work through the smallest harness that is safe. "Smallest" means minimal safe coordination, not zero delegation by default.

### 1. Inline Direct

Use inline execution when the task is small, mechanical, and the parent already has enough context.

Examples:

- typo, rename, one-file mechanical edit;
- small known bug with clear location;
- focused verification over 1-3 files;
- bash for state, e.g. `git status` or `gh issue view`.

Do not add SDD ceremony. Do not delegate just to look sophisticated. But do not use this exception to avoid delegation after the task stops being small.

### 2. Simple Delegation

Delegate when the work would inflate parent context or requires focused exploration, validation, or multi-file implementation, but does not yet need a full SDD lifecycle.

Examples:

- understand an unfamiliar module;
- inspect 4+ files;
- investigate a failing test;
- implement a bounded multi-file change;
- run tests/builds and summarize results;
- fresh-context review.

Use the configured subagent runtime when available. Prefer the `subagent_*` tools (`subagent_run`, status/result helpers) when the Pi Subagents extension is installed, because they run the user's configured project/global subagent definitions and preserve history/background behavior.

The bounded multi-file writer precedence below is the explicit exception to this general runtime preference.

Choose subagent mode by orchestration dependency, not by task length:

- Use `mode: "task"` when the parent must consume the result and continue the workflow, including SDD phases, implementation batches, verification, review gates, and any delegated work whose output determines the next action.
- Use `mode: "background"` only for independent work where automatic parent continuation is not required. Background completion may notify the user and preserve history, but it is not a guarantee that the parent model will resume orchestration.

For bounded multi-file writes, prefer the installed package-owned `gentle-ai-worker`, then a user-configured `worker`. If neither worker definition exists, fall back to the native `Agent` even when `subagent_*` tools are available. This writer precedence overrides the general runtime preference above.

For delegation other than bounded multi-file writes, use the generic fallback:

If `subagent_*` tools are unavailable, fall back to Pi's native `Agent` tool or another available delegation mechanism. The delegation trigger remains mandatory; the fallback changes the runtime, not the requirement to delegate. If no delegation mechanism is available, stop the complex work and explain the blocker instead of silently continuing inline.

### Pi Subagent Model Routing

For generic Pi subagents (`delegate`, `worker`, `scout`, review lens agents, `context-builder`, `oracle`, `planner`, `researcher`, or other non-SDD agents), do not pass the `model` parameter by default. Let `pi-subagents` resolve model and thinking from `.pi/settings.json`, `.pi/subagents.json`, global subagent config, and runtime defaults.

SDD model assignment tables apply only to SDD/Judgment-Day phase agents. They must not be used for generic Pi delegation.

Only pass `model` for generic subagents when the user explicitly requests a model override for that launch.

Default balanced pattern for bounded implementation:

```text
parent clarifies and checks git → scout/context-builder when context-heavy → one worker writes → selected review lens audits diff → parent validates and reports
```

Do not make every task SDD. Do make non-trivial tasks multi-agent at the narrowest useful point.

### 3. SDD

Use SDD for large, ambiguous, architectural, product-facing, multi-area, or high-review-risk work.

Triggers:

- unclear requirements or acceptance criteria;
- architectural/product decisions;
- cross-cutting behavior changes;
- expected large diff or reviewer burden;
- need for specs/design/tasks before safe implementation;
- user explicitly asks to use SDD, or invokes `/sdd-new`, `/sdd-ff`, or `/sdd-continue`.

If the request is large enough for SDD, do not jump directly to implementation. Calibrate context, create artifacts, and ask for approval at the appropriate gates.

## Delegation Rules

Core question: does this inflate parent context without need?

| Action                                               | Inline |                Delegate |
| ---------------------------------------------------- | -----: | ----------------------: |
| Read to decide/verify 1-3 files                      |    yes |                      no |
| Read to explore/understand 4+ files                  |     no |                     yes |
| Read as preparation for multi-file writing           |     no |                     yes |
| Write atomic one-file mechanical change              |    yes |                      no |
| Write with analysis across multiple files            |     no |                     yes |
| Bash for state, e.g. git status                      |    yes |                      no |
| Bash for execution, e.g. tests/builds                |     no |                     yes |
| Commit, push, or open PR after code changes          |     no | yes, fresh review first |
| Recover from wrong cwd/worktree/git/tooling incident |     no |  yes, fresh audit first |

### Mandatory Delegation Triggers

These are parent-orchestrator stop rules. Once any trigger fires, the parent MUST delegate through the best available subagent runtime. Prefer `subagent_run` when present; otherwise use Pi's native `Agent` or another available delegation mechanism. Do not replace a required delegation with inline execution. Do not inject these as child-agent permission to spawn subagents; children receive concrete role work and must not orchestrate.

The bounded multi-file writer precedence in rule 2 overrides that general runtime preference. If no delegation mechanism is available, stop and explain the blocker.

1. **4-file rule**: if understanding requires reading 4+ files, launch `scout`, `context-builder`, or the closest read-only mapping subagent with fresh context and a narrow mapping task. State the fallback agent/runtime if the preferred one is unavailable.
2. **Multi-file write rule**: if implementation will touch 2+ non-trivial files, delegate one writer; inline writing is allowed only for trivial/mechanical edits. A fresh review still follows delegated implementation.
   For bounded multi-file writes, prefer the installed package-owned `gentle-ai-worker`, then a user-configured `worker`. If neither worker definition exists, fall back to the native `Agent` even when `subagent_*` tools are available. If no delegation mechanism is available, stop and explain the blocker.

3. **PR rule**: before commit/push/PR for code changes, select a fresh-context review lens unless the diff is trivial docs/text-only.
4. **Incident rule**: after wrong `cwd`, accidental repo/worktree mutation, failed merge recovery, confusing test command, or environment workaround, stop and run a fresh audit through the relevant review lens before continuing.
5. **Long-session rule**: if accumulating work is no longer clearly local — roughly 20 tool calls, 5 exploratory file reads, or 2 non-mechanical edits without delegation — pause and delegate the remaining work instead of silently continuing monolithically.
6. **Fresh review rule**: use fresh-context review lens subagents for adversarial review of diffs, conflicts, PR readiness, and incidents. Use continuity-oriented workers only for implementation work that needs inherited state.

### Cost and Context Balance

Prefer delegation when fresh context improves correctness more than token savings:

- Use `scout`/`context-builder` to compress broad repo exploration into a short handoff instead of loading many files into the parent.
- Use a single `worker` for one writer thread; do not run parallel writers unless isolated worktrees are explicitly approved.
- Use fresh concrete review lens agents after implementation, conflict resolution, or incidents because their value is independence from the parent's assumptions. Do not call a generic `reviewer` subagent; choose from `review-risk`, `review-reliability`, `review-resilience`, `review-readability`, or the full 4R set.
- Use `outputMode: "file-only"` for large child reports and summarize only decisions, blockers, and paths in the parent thread.
- Avoid delegation for truly local one-file fixes, quick state checks, and already-understood mechanical edits.

### Canonical Lightweight Workflows

Bugfix with unfamiliar flow:

```text
parent git/status + clarify → scout fresh maps flow/files → parent decides → worker fork implements + tests → selected review lens audits diff → parent validates
```

Conflict or dependency-marker cleanup:

```text
parent reproduces/checks conflict → parent or worker resolves → selected review lens checks markers, package/lock consistency, and repo cleanliness → parent reports/pushes
```

After tooling/worktree incident:

```text
stop writes → parent captures git status → selected review lens audits affected repos/worktrees with no edits → parent applies only confirmed recovery steps
```

### Review Lens Selection

`reviewer` is an intent, not an installed subagent name. The parent must select concrete review agents by risk profile:

| Context | Review lens |
| --- | --- |
| Clear naming, structure, maintainability, small refactors | `review-readability` |
| Behavior, state, tests, determinism, regressions | `review-reliability` |
| Shell/process integration, partial failures, recovery, degraded dependencies | `review-resilience` |
| Security, permissions, data exposure/loss, architecture, dependencies | `review-risk` |
| Large PR, hot path, or >400 changed lines | Full 4R: `review-risk`, `review-resilience`, `review-readability`, `review-reliability` |

If multiple rows match, run the narrow set that covers the risk. Example: shell integration that mutates live state should use `review-reliability` plus `review-resilience`, not `review-readability` by default.

## 4R Review Triggers

The extension classifies recognized git/gh workflow diffs and emits advice only:

- **Trivial**: use zero lenses only when complete evidence proves every change is documentation, comments, formatting, or a string typo and no executable/configuration content changed.
- **Standard**: use exactly one dominant lens. Precedence is risk, resilience, reliability, then readability fallback. Ambiguous executable/configuration changes fail conservatively to standard.
- **Full 4R**: for a non-trivial hot path or strictly more than 400 changed lines, use `review-risk`, `review-resilience`, `review-readability`, and `review-reliability` in that order. Exactly 400 remains standard; 401 is full.
- **Event ceiling**: pre-commit and pre-push never run full 4R; cap them at one standard lens. Pre-PR, CI, and schedule may run full 4R.

Review advice never pauses, denies, or requires a receipt. Continue to independent command safety after notification; dangerous-command denial or confirmation remains authoritative. Post-SDD design/apply uses the separate Judgment Day path.

### Review Execution Contract

The parent owns merge, persistence, refutation, voting, fixes, and scoped re-review. The static `4r-review` chain performs lens discovery and returns reports only.

**Precision limits.** Standard review runs exactly one complete sweep. Full 4R runs at most two complete sweeps per lens. Every finding MUST include concrete evidence of user impact; speculative findings are rejected.

**Findings ledger.** Emit a findings ledger with this schema for every entry:

| Field | Values |
|-------|--------|
| `id` | `{LENS}-{NNN}` (e.g. `R1-001`) |
| `lens` | risk \| readability \| reliability \| resilience \| judgment-day |
| `location` | `path/to/file.ext:line` or `:start-end` |
| `severity` | BLOCKER \| CRITICAL \| WARNING \| SUGGESTION |
| `status` | open \| refuted \| fixed \| verified \| wont-fix \| info |
| `evidence` | why it matters |

`refuted` is terminal and MUST NOT be reopened by later rounds. WARNING and SUGGESTION rows are recorded once with status `info` and MUST NOT schedule fixes.

**Ledger persistence honors the artifact store.**
- `openspec`: write `openspec/changes/{change-name}/review-ledger.md`.
- `engram`: upsert topic `sdd/{change-name}/review-ledger` (ad-hoc judgment-day without a change: `review/{target-slug}/ledger`, where `target-slug` = `pr-{number}` when reviewing a PR, else the current branch name kebab-cased, else a kebab-case slug of the user-stated review target). If the engram upsert fails or the memory tool is unavailable, fall back to keeping the ledger inline in the response and explicitly report the degradation — never continue as if persistence succeeded.
- `none`: keep the ledger inline in the response; do not write files or Engram artifacts — the ledger lives only in this conversation; complete the review → fix → re-review loop within the session because it is not persisted across compaction.

If the first pass finds nothing, persist an empty ledger record rather than skip persistence.

**Constant refutation.** When no surviving BLOCKER/CRITICAL candidates exist, refutation launches zero actors. Standard review launches exactly one non-parallel general refuter. Full 4R launches exactly three parallel refuters: correctness, impact/exploitability, and reproducibility. Every active refuter receives the complete merged BLOCKER/CRITICAL candidate list. Per-finding refuter tasks and replacement refuters are forbidden.

**Mode-specific voting.** Refuter outputs are keyed by finding ID. In standard review, the general refuter's single `refuted` verdict terminally refutes only that finding. In full 4R, at least two of three valid `refuted` verdicts terminally refute only that finding. `stands`, unknown, duplicate, malformed, omitted, or missing verdicts preserve the finding.

**Scoped convergence.** Re-review receives only the authoritative ledger and the fix diff. Re-review assesses affected ledger rows and regressions introduced by the fix. Only surviving BLOCKER/CRITICAL rows MAY schedule a fix round. At most two scoped fix/re-review rounds may run. Severe rows surviving round two MUST escalate; a third round MUST NOT run.

**Judgment Day exception.** Each Judgment Day judge runs exactly one complete blind sweep. Judgment Day launches exactly two blind judges in parallel and zero refuters. Judgment Day applies the same two-round limit to surviving BLOCKER/CRITICAL rows. Judgment Day WARNING and SUGGESTION rows remain `info` and MUST NOT schedule fixes.

Subagent execution-mode: this agent runs its lens exhaustively as a dedicated Pi subagent and returns its own ledger rows in its Output; the orchestrator merges those ledger rows into the persisted ledger.

Fix execution-mode: jd-fix-agent applies only confirmed ledger findings and hands control back to the orchestrator, which runs the scoped re-judge.
