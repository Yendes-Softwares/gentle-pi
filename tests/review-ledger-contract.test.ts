import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");

function read(relPath: string): string {
	return readFileSync(join(repoRoot, relPath), "utf8");
}

// ---------------------------------------------------------------------------
// Named clause groups are explicit so parity cannot depend on positional
// slicing or accidental prose overlap.
// ---------------------------------------------------------------------------

const precisionLimitClauses = Object.freeze([
	"Standard review runs exactly one complete sweep.",
	"Full 4R runs at most two complete sweeps per lens.",
	"Every finding MUST include concrete evidence of user impact; speculative findings are rejected.",
]);

// Ledger schema fields. Full enum strings, not truncated prefixes: a prefix
// match would still pass if a replicated asset dropped a trailing enum value
// (JD-004 mitigation).
const ledgerSchemaClauses = Object.freeze([
	"`id` | `{LENS}-{NNN}`",
	"`lens` | risk \\| readability \\| reliability \\| resilience \\| judgment-day |",
	"`location` | `path/to/file.ext:line` or `:start-end`",
	"`severity` | BLOCKER \\| CRITICAL \\| WARNING \\| SUGGESTION |",
	"`status` | open \\| refuted \\| fixed \\| verified \\| wont-fix \\| info |",
	"`evidence` | why it matters |",
	"persist an empty ledger record rather than skip persistence",
]);

const terminalRowsClauses = Object.freeze([
	"`refuted` is terminal and MUST NOT be reopened by later rounds.",
	"WARNING and SUGGESTION rows are recorded once with status `info` and MUST NOT schedule fixes.",
]);

const judgmentDayPrecisionClauses = Object.freeze([
	"Each Judgment Day judge runs exactly one complete blind sweep.",
]);

// Persistence branches on the artifact store.
const ledgerPersistenceClauses = Object.freeze([
	"write `openspec/changes/{change-name}/review-ledger.md`",
	"upsert topic `sdd/{change-name}/review-ledger`",
	"ad-hoc judgment-day without a change: `review/{target-slug}/ledger`",
	// target-slug derivation rule: deterministic so ad-hoc sessions don't guess
	// divergent keys.
	"`target-slug` = `pr-{number}` when reviewing a PR, else the current branch name kebab-cased, else a kebab-case slug of the user-stated review target",
	"do not write files or Engram artifacts",
	"the ledger lives only in this conversation",
	// Compaction caveat for the `none` store, folded into the hand-copied
	// `none` bullet instead of living only in a non-copied note.
	"complete the review → fix → re-review loop within the session because it is not persisted across compaction",
	// EXT-004: degraded-path fallback for the `engram` branch — if the upsert
	// fails or the tool is unavailable, fall back to inline persistence and
	// report the degradation instead of silently losing the ledger.
	"If the engram upsert fails or the memory tool is unavailable, fall back to keeping the ledger inline in the response and explicitly report the degradation — never continue as if persistence succeeded.",
]);

const scopedReReviewClauses = Object.freeze([
	"Re-review receives only the authoritative ledger and the fix diff.",
	"Re-review assesses affected ledger rows and regressions introduced by the fix.",
]);

const actorCountClauses = Object.freeze([
	"When no surviving BLOCKER/CRITICAL candidates exist, refutation launches zero actors.",
	"Standard review launches exactly one non-parallel general refuter.",
	"Full 4R launches exactly three parallel refuters: correctness, impact/exploitability, and reproducibility.",
	"Every active refuter receives the complete merged BLOCKER/CRITICAL candidate list.",
	"Per-finding refuter tasks and replacement refuters are forbidden.",
]);

const modeSpecificVotingClauses = Object.freeze([
	"Refuter outputs are keyed by finding ID.",
	"In standard review, the general refuter's single `refuted` verdict terminally refutes only that finding.",
	"In full 4R, at least two of three valid `refuted` verdicts terminally refute only that finding.",
	"`stands`, unknown, duplicate, malformed, omitted, or missing verdicts preserve the finding.",
]);

const roundLimitClauses = Object.freeze([
	"Only surviving BLOCKER/CRITICAL rows MAY schedule a fix round.",
	"At most two scoped fix/re-review rounds may run.",
	"Severe rows surviving round two MUST escalate; a third round MUST NOT run.",
]);

const judgmentDayClauses = Object.freeze([
	"Judgment Day launches exactly two blind judges in parallel and zero refuters.",
	"Judgment Day applies the same two-round limit to surviving BLOCKER/CRITICAL rows.",
	"Judgment Day WARNING and SUGGESTION rows remain `info` and MUST NOT schedule fixes.",
]);

// Pi is subagent-primary ONLY (real review-*/jd-* subagents); there is no
// inline-mode clause — dropped entirely, aligning with the stop-not-inline
// delegation policy at assets/orchestrator.md:92.
const subagentExecutionModeClause =
	"Subagent execution-mode: this agent runs its lens exhaustively as a dedicated Pi subagent and returns its own ledger rows in its Output; the orchestrator merges those ledger rows into the persisted ledger.";

const fixExecutionModeClause =
	"Fix execution-mode: jd-fix-agent applies only confirmed ledger findings and hands control back to the orchestrator, which runs the scoped re-judge.";

const requiredJudgePromptClauses = Object.freeze([
	...judgmentDayPrecisionClauses,
	...ledgerSchemaClauses,
	...terminalRowsClauses,
	...ledgerPersistenceClauses,
	...judgmentDayClauses,
]);

const requiredReviewLensClauses = Object.freeze([
	...precisionLimitClauses,
	...ledgerSchemaClauses,
	...terminalRowsClauses,
	...ledgerPersistenceClauses,
	...scopedReReviewClauses,
	subagentExecutionModeClause,
]);

const requiredJudgmentDayClauses = Object.freeze([
	...requiredJudgePromptClauses,
	...scopedReReviewClauses,
	subagentExecutionModeClause,
]);

const requiredCanonicalClauses = Object.freeze([
	...requiredReviewLensClauses,
	...judgmentDayPrecisionClauses,
	...actorCountClauses,
	...modeSpecificVotingClauses,
	...roundLimitClauses,
	...judgmentDayClauses,
]);

// requiredFixAgentClauses are the fix-specific clauses jd-fix-agent.md (and
// the Fix Agent Prompt fence) must carry instead of requiredJudgeClauses. The
// fix agent applies confirmed fixes; it does not run the exhaustive first
// pass and does not emit a findings ledger, so pasting the judge contract
// verbatim contradicts its own "fix ONLY confirmed issues" rules (JD-001).
const requiredFixAgentClauses = Object.freeze([
	"does NOT run the exhaustive first-pass sweep and does NOT emit a findings ledger",
	"Read the ledger entries the orchestrator confirmed and passed in the delegate prompt",
	"set that entry's `status` to `fixed`",
	"Never add new ledger rows: if fixing surfaces a new problem, report it back to the orchestrator instead of fixing it or logging it yourself",
	"Only surviving BLOCKER/CRITICAL rows may be fixed; WARNING and SUGGESTION remain `info`.",
	fixExecutionModeClause,
]);

// judgeOnlyMarkers are judge-role clauses that must NOT appear in fix-agent
// surfaces. If the judge contract block (exhaustive first pass, findings
// ledger emission, judge execution mode) is ever pasted back into a
// fix-agent surface alongside the fix clauses, these markers catch it
// (JD-001/JD-011 regression guard).
const judgeOnlyMarkers = Object.freeze([
	"**Precision limits.**",
	"Emit a findings ledger with this schema for every entry",
	subagentExecutionModeClause,
]);

// requiredEnumFragments are the bare severity/status/lens enum strings
// asserted, complete and untruncated, wherever the ledger schema is present
// — including jd-fix-agent, which needs the valid `status` enum to set
// entries to `fixed` even though it never emits new ledger rows (JD-004).
const requiredEnumFragments = Object.freeze([
	"BLOCKER \\| CRITICAL \\| WARNING \\| SUGGESTION",
	"open \\| refuted \\| fixed \\| verified \\| wont-fix \\| info",
	"risk \\| readability \\| reliability \\| resilience \\| judgment-day",
]);

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

const reviewLensSurfaces = Object.freeze([
	"assets/agents/review-risk.md",
	"assets/agents/review-readability.md",
	"assets/agents/review-reliability.md",
	"assets/agents/review-resilience.md",
]);

const judgmentDaySurfaces = Object.freeze([
	"assets/agents/jd-judge-a.md",
	"assets/agents/jd-judge-b.md",
	"skills/judgment-day/SKILL.md",
]);

const fixAgentSurface = "assets/agents/jd-fix-agent.md";

const enumFragmentSurfaces = Object.freeze([
	...reviewLensSurfaces,
	...judgmentDaySurfaces,
	fixAgentSurface,
]);

const promptsAndFormatsPath = "skills/judgment-day/references/prompts-and-formats.md";

const orchestratorPath = "assets/orchestrator.md";

const chainPath = "assets/chains/4r-review.chain.md";

const canonicalPath = "skills/_shared/review-ledger-contract.md";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertContainsAll(label: string, content: string, clauses: readonly string[]): void {
	for (const clause of clauses) {
		assert.ok(content.includes(clause), `${label} missing required ledger clause: ${JSON.stringify(clause)}`);
	}
}

function assertContainsNone(label: string, content: string, markers: readonly string[]): void {
	for (const marker of markers) {
		assert.ok(!content.includes(marker), `${label} must NOT contain judge-only marker: ${JSON.stringify(marker)}`);
	}
}

// extractFencedBlockAfterHeading returns the contents of the first fenced
// code block that follows the given markdown heading in content. The heading
// is matched by EXACT LINE EQUALITY (not substring) — deliberate Pi-side
// hardening beyond canonical gentle-ai, whose own
// extractFencedBlockAfterHeading (review_ledger_contract_test.go:191-198)
// still uses a substring search and carries an unresolved prefix-collision
// risk (archived ledger JD-014, status `info`). A clause that lives in prose
// outside the fence (placement drift, JD-013) cannot silently satisfy a
// whole-file `includes` check because we scope the assertion to the
// extracted fence body only.
function extractFencedBlockAfterHeading(label: string, content: string, heading: string): string {
	const lines = content.split("\n");
	const headingOccurrences = lines.filter((line) => line === heading).length;
	assert.ok(headingOccurrences !== 0, `${label}: heading ${JSON.stringify(heading)} not found (exact line match)`);
	assert.ok(
		headingOccurrences === 1,
		`${label}: heading ${JSON.stringify(heading)} occurs ${headingOccurrences} times (exact line match) — extraction requires a unique heading`,
	);
	const headingIndex = lines.findIndex((line) => line === heading);

	let fenceStart = -1;
	for (let i = headingIndex + 1; i < lines.length; i++) {
		if (lines[i]?.startsWith("```")) {
			fenceStart = i;
			break;
		}
	}
	assert.ok(fenceStart !== -1, `${label}: no fenced block found after heading ${JSON.stringify(heading)}`);

	let fenceEnd = -1;
	for (let i = fenceStart + 1; i < lines.length; i++) {
		if (lines[i]?.startsWith("```")) {
			fenceEnd = i;
			break;
		}
	}
	assert.ok(fenceEnd !== -1, `${label}: unterminated fenced block after heading ${JSON.stringify(heading)}`);

	return lines.slice(fenceStart + 1, fenceEnd).join("\n");
}

// ---------------------------------------------------------------------------
// extractFencedBlockAfterHeading — synthetic unit tests
// ---------------------------------------------------------------------------

test("extractFencedBlockAfterHeading throws loudly on a duplicated heading", () => {
	const content = ["## Heading", "```", "first block", "```", "## Heading", "```", "second block", "```"].join(
		"\n",
	);
	assert.throws(
		() => extractFencedBlockAfterHeading("synthetic", content, "## Heading"),
		/occurs 2 times/,
		"duplicate heading must fail loudly instead of silently extracting the first match",
	);
});

test("extractFencedBlockAfterHeading throws when the heading is missing", () => {
	const content = ["## Other Heading", "```", "block", "```"].join("\n");
	assert.throws(
		() => extractFencedBlockAfterHeading("synthetic", content, "## Heading"),
		/not found \(exact line match\)/,
	);
});

test("extractFencedBlockAfterHeading throws when the fenced block is unterminated", () => {
	const content = ["## Heading", "```", "unterminated block, no closing fence"].join("\n");
	assert.throws(
		() => extractFencedBlockAfterHeading("synthetic", content, "## Heading"),
		/unterminated fenced block/,
	);
});

test("extractFencedBlockAfterHeading extracts the correct block for a unique heading", () => {
	const content = ["## Heading", "```", "the content", "```"].join("\n");
	assert.equal(extractFencedBlockAfterHeading("synthetic", content, "## Heading"), "the content");
});

test("canonical review-ledger-contract source carries the full judge clause set", () => {
	const content = read(canonicalPath);
	assertContainsAll(canonicalPath, content, requiredCanonicalClauses);
	assertContainsAll(canonicalPath, content, requiredEnumFragments);
});

for (const [scenario, clauses] of Object.entries({
	"Precision limits": precisionLimitClauses,
	"Terminal rows": terminalRowsClauses,
	"Persistence fallback": ledgerPersistenceClauses,
	"Actor counts": actorCountClauses,
	"Mode-specific voting and fail-closed handling": modeSpecificVotingClauses,
	"Scoped re-review": scopedReReviewClauses,
	"Round limit": roundLimitClauses,
	"Judgment Day exception": judgmentDayClauses,
})) {
	test(`canonical parity: ${scenario}`, () => {
		assertContainsAll(canonicalPath, read(canonicalPath), clauses);
	});
}

test("canonical source carries the fix-agent clause set for reference", () => {
	const content = read(canonicalPath);
	// The canonical doc documents the fix-role clause set as an exception, not
	// a hand-copy target for the judge block — but the no-sweep/no-emit fix
	// clause fragment should still be traceable in the doc's adopting-assets
	// notes.
	assertContainsAll(canonicalPath, content, [
		"does NOT run the exhaustive first-pass sweep and does NOT emit a findings ledger",
	]);
});

for (const surface of reviewLensSurfaces) {
	test(`${surface} carries the review-lens parity clauses`, () => {
		const content = read(surface);
		assertContainsAll(surface, content, requiredReviewLensClauses);
	});

	test(`${surface} does not absorb parent or Judgment Day orchestration`, () => {
		const content = read(surface);
		assertContainsNone(surface, content, [
			...actorCountClauses,
			...modeSpecificVotingClauses,
			...roundLimitClauses,
			...judgmentDayClauses,
			"Loop until dry",
		]);
	});
}

for (const surface of judgmentDaySurfaces) {
	test(`${surface} carries the Judgment Day parity clauses`, () => {
		const content = read(surface);
		assertContainsAll(surface, content, requiredJudgmentDayClauses);
	});

	test(`${surface} does not absorb 4R refuter voting`, () => {
		assertContainsNone(surface, read(surface), [
			...actorCountClauses,
			...modeSpecificVotingClauses,
			"Loop until dry",
		]);
	});
}

test("canonical parent clauses are unique and cannot drift into duplicate policies", () => {
	const content = read(canonicalPath);
	for (const clause of [...actorCountClauses, ...modeSpecificVotingClauses, ...roundLimitClauses]) {
		assert.equal(
			content.split(clause).length - 1,
			1,
			`${canonicalPath} must contain exactly one parent clause: ${JSON.stringify(clause)}`,
		);
	}
});

for (const surface of enumFragmentSurfaces) {
	test(`${surface} carries complete, untruncated enum rows`, () => {
		const content = read(surface);
		assertContainsAll(surface, content, requiredEnumFragments);
	});
}

test(`${fixAgentSurface} carries only the fix-role clause set`, () => {
	const content = read(fixAgentSurface);
	assertContainsAll(fixAgentSurface, content, requiredFixAgentClauses);
	assertContainsNone(fixAgentSurface, content, judgeOnlyMarkers);
});

test(`${promptsAndFormatsPath} Judge Prompt fence carries requiredJudgePromptClauses`, () => {
	const content = read(promptsAndFormatsPath);
	const judgeBlock = extractFencedBlockAfterHeading(promptsAndFormatsPath, content, "## Judge Prompt");
	assertContainsAll(`${promptsAndFormatsPath} Judge Prompt fence`, judgeBlock, requiredJudgePromptClauses);
});

test(`${promptsAndFormatsPath} Fix Agent Prompt fence carries requiredFixAgentClauses and no judge-only markers`, () => {
	const content = read(promptsAndFormatsPath);
	const fixBlock = extractFencedBlockAfterHeading(promptsAndFormatsPath, content, "## Fix Agent Prompt");
	assertContainsAll(`${promptsAndFormatsPath} Fix Agent Prompt fence`, fixBlock, requiredFixAgentClauses);
	// Pi-side hardening beyond canonical (archived ledger JD-015, status
	// `info`): scope the negative marker assertion to the extracted fence
	// content, not just the whole file.
	assertContainsNone(`${promptsAndFormatsPath} Fix Agent Prompt fence`, fixBlock, judgeOnlyMarkers);
});

// Per port-review-ledger-contract's spec amendment ("Clauses live inside
// copy-pasteable prompt templates"): the scoped-re-review contract and both
// named execution-mode clauses are documented outside the Judge/Fix Prompt
// fences, in the file's "## Ledger and Re-Judge Contract" prose section
// (they govern the re-judge round AFTER a prompt is issued, not the prompt
// content itself). This whole-file assertion guards that prose section so a
// future edit cannot silently delete it — mirrors gentle-ai's
// judgment_day_skill_assets subtest, which asserts the same clauses on
// SKILL.md's whole-file body.
test(`${promptsAndFormatsPath} documents the scoped re-review contract and both execution-mode clauses outside the fences`, () => {
	const content = read(promptsAndFormatsPath);
	assertContainsAll(promptsAndFormatsPath, content, scopedReReviewClauses);
	assertContainsAll(promptsAndFormatsPath, content, [subagentExecutionModeClause, fixExecutionModeClause]);
});

test(`${orchestratorPath} Review Execution Contract carries persistence branches and both execution-mode clauses`, () => {
	// orchestrator-lazy-diet: the persistence-branch bullets stay verbatim in
	// the always-on core; the empty-ledger rule and both execution-mode
	// clauses moved to assets/orchestrator-delegation.md. Union read so this
	// assertion is repointed, not weakened.
	const content = read(orchestratorPath) + read("assets/orchestrator-delegation.md");
	assertContainsAll(orchestratorPath, content, ledgerPersistenceClauses);
	assertContainsAll(orchestratorPath, content, [
		"persist an empty ledger record rather than skip persistence",
		subagentExecutionModeClause,
		fixExecutionModeClause,
	]);
});

test(`${orchestratorPath} owns all dynamic batching, voting, persistence, and convergence clauses`, () => {
	const content = read(orchestratorPath) + read("assets/orchestrator-delegation.md");
	assertContainsAll(orchestratorPath, content, [
		...precisionLimitClauses,
		...ledgerSchemaClauses,
		...terminalRowsClauses,
		...ledgerPersistenceClauses,
		...actorCountClauses,
		...modeSpecificVotingClauses,
		...scopedReReviewClauses,
		...roundLimitClauses,
		...judgmentDayPrecisionClauses,
		...judgmentDayClauses,
	]);
});

test(`${chainPath} is lens-only and returns four complete discovery reports`, () => {
	const content = read(chainPath);
	assert.ok(
		!content.includes("say exactly: `No findings.`"),
		`${chainPath} must not carry the old "say exactly: No findings." wording`,
	);
	const occurrences = content.split("return an empty ledger record rather than omit the report").length - 1;
	assert.equal(
		occurrences,
		4,
		`${chainPath} must return one report per lens, including empty ledgers`,
	);
	for (const lens of ["review-risk", "review-readability", "review-reliability", "review-resilience"]) {
		assert.equal(
			content.split(`## ${lens}`).length - 1,
			1,
			`${chainPath} must run ${lens} exactly once`,
		);
	}
	assertContainsNone(chainPath, content, [
		...actorCountClauses,
		...modeSpecificVotingClauses,
		...roundLimitClauses,
		...judgmentDayClauses,
		"review-refuter",
		"fix/re-review",
		"Ledger persistence",
	]);
});
