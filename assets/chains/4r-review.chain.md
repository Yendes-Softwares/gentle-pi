---
name: 4r-review
description: Lens-only full 4R discovery in stable risk, resilience, readability, reliability order; the parent owns merge and orchestration.
---

## review-risk

output: review-risk-report.md
outputMode: file-only
progress: true

Run R1 Risk review on the current diff. Return the complete findings ledger for security, privilege boundaries, data exposure, dependencies, and merge-blocking vulnerabilities. If clean, return an empty ledger record rather than omit the report.

## review-resilience

output: review-resilience-report.md
outputMode: file-only
progress: true

Run R4 Resilience review on the current diff. Return the complete findings ledger for fallbacks, retry/backoff, graceful degradation, observability, load, rollback, and SLO risks. If clean, return an empty ledger record rather than omit the report.

## review-readability

output: review-readability-report.md
outputMode: file-only
progress: true

Run R2 Readability review on the current diff. Return the complete findings ledger for naming, complexity, intention, maintainability, review size, and context clarity. If clean, return an empty ledger record rather than omit the report.

## review-reliability

output: review-reliability-report.md
outputMode: file-only
progress: true

Run R3 Reliability review on the current diff. Return the complete findings ledger for behavior-first test coverage, edge cases, determinism, contracts, and regressions. If clean, return an empty ledger record rather than omit the report.
