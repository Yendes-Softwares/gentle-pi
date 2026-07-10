---
name: gentle-ai-judgment-day
description: "Trigger: judgment day, judgement day, dual review, adversarial review, juzgar. Run blind dual review, fix confirmed issues, then re-judge."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.4"
---

## Activation Contract

Load this skill only when the user explicitly asks for Judgment Day, Judgement Day, dual/adversarial review, or equivalent Spanish trigger (`juzgar`, `que lo juzguen`). Review a specific target: files, feature, PR, or architecture slice.

## Hard Rules

- Resolve project skills before launching agents: read skill registry, match indexed paths by target files/task, and pass the same `Skills to load before work` block into both judge prompts and fix prompts.
- Launch **two blind judges in parallel** with identical target and criteria and zero refuters; never review the code yourself.
- Wait for both judges before synthesis; never accept a partial verdict.
- Record WARNING and SUGGESTION once as `info`; neither severity may schedule a fix.
- Ask before fixing surviving BLOCKER/CRITICAL rows in Round 1.
- After any fix agent runs, immediately re-launch both judges in parallel before commit/push/done/session summary.
- Terminal states are only `JUDGMENT: APPROVED` or `JUDGMENT: ESCALATED`.
- After two fix iterations with surviving BLOCKER/CRITICAL rows, escalate; never run a third round.

## Decision Gates

| Condition | Action |
|---|---|
| Target unclear | Ask for scope; do not launch judges. |
| No skill registry | Warn, proceed with generic criteria, and record `Skill Resolution: none`. |
| Both judges find same BLOCKER/CRITICAL | Confirmed; ask/fix according to round rules. |
| One judge finds issue | Suspect; report and triage, do not auto-fix. |
| Judges contradict | Escalate for manual decision. |
| WARNING/SUGGESTION only | Report as INFO; do not fix or re-judge. |

## Execution Steps

1. Confirm target and optional custom criteria.
2. Resolve compact project standards from registry or warn if missing.
3. Start Judge A and Judge B concurrently via delegation; launch zero refuters.
4. Synthesize findings into confirmed, suspect, contradiction, and INFO buckets.
5. Ask before Round 1 fixes; delegate a separate fix agent for confirmed surviving BLOCKER/CRITICAL rows only.
6. Re-judge in parallel after fixes, using only the ledger and fix diff; stop after at most two fix/re-judge rounds.
7. Before any terminal action, verify every active Judgment Day has a terminal state.

## Output Contract

Return `## Judgment Day — {target}` with round number, verdict table, confirmed/suspect/contradiction counts, fixes applied, re-judgment result, `Skill Resolution`, and final `JUDGMENT: APPROVED ✅` or `JUDGMENT: ESCALATED ⚠️`.

## Ledger and Re-Judge Contract

Each Judgment Day judge runs exactly one complete blind sweep. Every finding MUST include concrete evidence of user impact; speculative findings are rejected.

**Findings ledger.** Emit a findings ledger with this schema for every entry:

| Field | Values |
|-------|--------|
| `id` | `{LENS}-{NNN}` (e.g. `R1-001`) |
| `lens` | risk \| readability \| reliability \| resilience \| judgment-day |
| `location` | `path/to/file.ext:line` or `:start-end` |
| `severity` | BLOCKER \| CRITICAL \| WARNING \| SUGGESTION |
| `status` | open \| refuted \| fixed \| verified \| wont-fix \| info |
| `evidence` | why it matters |

If the first pass finds nothing, persist an empty ledger record rather than skip persistence.

`refuted` is terminal and MUST NOT be reopened by later rounds. WARNING and SUGGESTION rows are recorded once with status `info` and MUST NOT schedule fixes.

**Ledger persistence honors the artifact store.**
- `openspec`: write `openspec/changes/{change-name}/review-ledger.md`.
- `engram`: upsert topic `sdd/{change-name}/review-ledger` (ad-hoc judgment-day without a change: `review/{target-slug}/ledger`, where `target-slug` = `pr-{number}` when reviewing a PR, else the current branch name kebab-cased, else a kebab-case slug of the user-stated review target). If the engram upsert fails or the memory tool is unavailable, fall back to keeping the ledger inline in the response and explicitly report the degradation — never continue as if persistence succeeded.
- `none`: keep the ledger inline in the response; do not write files or Engram artifacts — the ledger lives only in this conversation; complete the review → fix → re-review loop within the session because it is not persisted across compaction.

Judgment Day launches exactly two blind judges in parallel and zero refuters. Judgment Day applies the same two-round limit to surviving BLOCKER/CRITICAL rows. Judgment Day WARNING and SUGGESTION rows remain `info` and MUST NOT schedule fixes.

Re-review receives only the authoritative ledger and the fix diff. Re-review assesses affected ledger rows and regressions introduced by the fix.

Subagent execution-mode: this agent runs its lens exhaustively as a dedicated Pi subagent and returns its own ledger rows in its Output; the orchestrator merges those ledger rows into the persisted ledger.

## References

- [references/prompts-and-formats.md](references/prompts-and-formats.md) — judge/fix prompts, warning rubric, verdict tables, and language snippets.
