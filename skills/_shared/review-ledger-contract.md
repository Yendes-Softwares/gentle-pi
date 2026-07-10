# Review Ledger Contract

This is the canonical contract for review precision, ledger lifecycle, refutation, persistence, and bounded convergence. Role assets copy only the clauses they execute; the parent orchestrator owns batching, voting, persistence, fixes, and re-review.

## Review-lens contract

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

If the first pass finds nothing, persist an empty ledger record rather than skip persistence.

`refuted` is terminal and MUST NOT be reopened by later rounds. WARNING and SUGGESTION rows are recorded once with status `info` and MUST NOT schedule fixes.

**Ledger persistence honors the artifact store.**
- `openspec`: write `openspec/changes/{change-name}/review-ledger.md`.
- `engram`: upsert topic `sdd/{change-name}/review-ledger` (ad-hoc judgment-day without a change: `review/{target-slug}/ledger`, where `target-slug` = `pr-{number}` when reviewing a PR, else the current branch name kebab-cased, else a kebab-case slug of the user-stated review target). If the engram upsert fails or the memory tool is unavailable, fall back to keeping the ledger inline in the response and explicitly report the degradation — never continue as if persistence succeeded.
- `none`: keep the ledger inline in the response; do not write files or Engram artifacts — the ledger lives only in this conversation; complete the review → fix → re-review loop within the session because it is not persisted across compaction.

Re-review receives only the authoritative ledger and the fix diff. Re-review assesses affected ledger rows and regressions introduced by the fix.

Subagent execution-mode: this agent runs its lens exhaustively as a dedicated Pi subagent and returns its own ledger rows in its Output; the orchestrator merges those ledger rows into the persisted ledger.

## Parent orchestration contract

### Constant actor counts

When no surviving BLOCKER/CRITICAL candidates exist, refutation launches zero actors. Standard review launches exactly one non-parallel general refuter. Full 4R launches exactly three parallel refuters: correctness, impact/exploitability, and reproducibility. Every active refuter receives the complete merged BLOCKER/CRITICAL candidate list. Per-finding refuter tasks and replacement refuters are forbidden.

### Mode-specific voting

Refuter outputs are keyed by finding ID. In standard review, the general refuter's single `refuted` verdict terminally refutes only that finding. In full 4R, at least two of three valid `refuted` verdicts terminally refute only that finding. `stands`, unknown, duplicate, malformed, omitted, or missing verdicts preserve the finding.

### Bounded convergence

Only surviving BLOCKER/CRITICAL rows MAY schedule a fix round. At most two scoped fix/re-review rounds may run. Severe rows surviving round two MUST escalate; a third round MUST NOT run.

## Judgment Day exception

Each Judgment Day judge runs exactly one complete blind sweep. Judgment Day launches exactly two blind judges in parallel and zero refuters. Judgment Day applies the same two-round limit to surviving BLOCKER/CRITICAL rows. Judgment Day WARNING and SUGGESTION rows remain `info` and MUST NOT schedule fixes.

## Fix-agent exception

The fix agent does NOT run the exhaustive first-pass sweep and does NOT emit a findings ledger. It reads only confirmed surviving severe rows, updates addressed rows to `fixed`, and returns control to the parent. It never creates ledger rows or fixes informational findings.

## Adopting assets

- Review-lens clauses: `assets/agents/review-{risk,readability,reliability,resilience}.md`
- Judgment Day clauses: `assets/agents/jd-judge-{a,b}.md`, `skills/judgment-day/SKILL.md`, and `skills/judgment-day/references/prompts-and-formats.md`
- Fix-role clauses: `assets/agents/jd-fix-agent.md` and the Judgment Day fix prompt
- Parent orchestration clauses: `assets/orchestrator*.md`; dynamic batching, voting, persistence, and convergence MUST remain outside `assets/chains/4r-review.chain.md`
