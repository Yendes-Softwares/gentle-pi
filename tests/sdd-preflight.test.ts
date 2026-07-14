import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	installSddAssets,
	readSddPreflightFromDisk,
	sddPreflightDiskPath,
	writeSddPreflightToDisk,
	type SddPreflightPreferences,
} from "../lib/sdd-preflight.ts";

async function workspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), "gentle-pi-sdd-preflight-"));
}

const SAMPLE_PREFS: SddPreflightPreferences = {
	executionMode: "auto",
	artifactStore: "engram",
	chainedPrStrategy: "auto-forecast",
	reviewBudgetLines: 400,
	engramAvailable: true,
	prompted: true,
};

test("sddPreflightDiskPath returns project-local .pi/gentle-ai/sdd-preflight.json", async () => {
	const cwd = await workspace();
	const path = sddPreflightDiskPath(cwd);
	assert.equal(path, join(cwd, ".pi", "gentle-ai", "sdd-preflight.json"));
});

test("writeSddPreflightToDisk creates parent dirs and writes valid JSON", async () => {
	const cwd = await workspace();
	writeSddPreflightToDisk(cwd, SAMPLE_PREFS);

	const path = sddPreflightDiskPath(cwd);
	assert.ok(existsSync(path));
	const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
	assert.deepEqual(parsed, SAMPLE_PREFS);
});

test("readSddPreflightFromDisk returns undefined when no file exists", async () => {
	const cwd = await workspace();
	assert.equal(readSddPreflightFromDisk(cwd), undefined);
});

test("readSddPreflightFromDisk returns persisted prefs after write", async () => {
	const cwd = await workspace();
	writeSddPreflightToDisk(cwd, SAMPLE_PREFS);

	const loaded = readSddPreflightFromDisk(cwd);
	assert.deepEqual(loaded, SAMPLE_PREFS);
});

test("persisted store survives a simulated cache miss (write then cold read)", async () => {
	const cwd = await workspace();

	// Simulate ensureSddPreflight writing to disk
	writeSddPreflightToDisk(cwd, SAMPLE_PREFS);

	// Simulate a fresh process where in-memory Map is empty — only disk store exists
	const loaded = readSddPreflightFromDisk(cwd);
	assert.ok(loaded !== undefined);
	assert.equal(loaded.artifactStore, "engram");
	assert.equal(loaded.executionMode, "auto");
	assert.equal(loaded.prompted, true);
});

test("readSddPreflightFromDisk returns undefined for corrupt JSON", async () => {
	const cwd = await workspace();
	const path = sddPreflightDiskPath(cwd);
	mkdirSync(join(cwd, ".pi", "gentle-ai"), { recursive: true });
	writeFileSync(path, "not-json{{{");

	assert.equal(readSddPreflightFromDisk(cwd), undefined);
});

test("readSddPreflightFromDisk returns undefined for JSON with invalid fields", async () => {
	const cwd = await workspace();
	const path = sddPreflightDiskPath(cwd);
	mkdirSync(join(cwd, ".pi", "gentle-ai"), { recursive: true });
	writeFileSync(path, JSON.stringify({ executionMode: "invalid", artifactStore: "openspec", chainedPrStrategy: "auto-forecast", reviewBudgetLines: 400, engramAvailable: false, prompted: false }));

	// executionMode "invalid" is not "interactive" | "auto" → should reject
	assert.equal(readSddPreflightFromDisk(cwd), undefined);
});

test("readSddPreflightFromDisk normalizes unknown chainedPrStrategy to auto-forecast", async () => {
	const cwd = await workspace();
	const path = sddPreflightDiskPath(cwd);
	mkdirSync(join(cwd, ".pi", "gentle-ai"), { recursive: true });
	writeFileSync(path, JSON.stringify({
		executionMode: "interactive",
		artifactStore: "openspec",
		chainedPrStrategy: "unknown-strategy",
		reviewBudgetLines: 400,
		engramAvailable: false,
		prompted: true,
	}));

	const loaded = readSddPreflightFromDisk(cwd);
	assert.ok(loaded !== undefined);
	assert.equal(loaded.chainedPrStrategy, "auto-forecast");
});

test("writeSddPreflightToDisk is non-fatal when directory is not writable (no throw)", async () => {
	// Can only test the no-throw guarantee; the actual write failure is swallowed
	// We verify that calling with a deeply nested path doesn't throw
	assert.doesNotThrow(() => {
		writeSddPreflightToDisk("/nonexistent/path/that/cannot/be/created/gently", SAMPLE_PREFS);
	});
});

test("forced asset refresh migrates the exact v0.10.7 malformed sdd-apply asset and preserves user edits", () => {
	const packageRoot = join(import.meta.dirname, "..");
	const legacySource = readFileSync(
		join(
			packageRoot,
			"tests",
			"fixtures",
			"v0.10.7",
			"assets",
			"agents",
			"sdd-apply.md",
		),
		"utf8",
	);
	const currentSource = readFileSync(
		join(packageRoot, "assets", "agents", "sdd-apply.md"),
		"utf8",
	);
	const temporaryAgentHome = mkdtempSync(join(tmpdir(), "gentle-pi-v0107-preflight-"));
	const temporaryUserAgentHome = mkdtempSync(join(tmpdir(), "gentle-pi-v0107-user-preflight-"));
	const previousAgentHome = process.env.GENTLE_PI_AGENT_HOME;
	const installed = join(temporaryAgentHome, "agents", "sdd-apply.md");
	const userInstalled = join(temporaryUserAgentHome, "agents", "sdd-apply.md");
	const userEdited = legacySource.replace(
		"You are the SDD apply executor for Gentle AI.",
		"You are the user-customized SDD apply executor for Gentle AI.",
	);
	try {
		process.env.GENTLE_PI_AGENT_HOME = temporaryAgentHome;
		mkdirSync(join(temporaryAgentHome, "agents"), { recursive: true });
		writeFileSync(installed, legacySource);
		mkdirSync(join(temporaryAgentHome, "gentle-ai"), { recursive: true });
		writeFileSync(
			join(temporaryAgentHome, "gentle-ai", "managed-assets.json"),
			JSON.stringify({ schemaVersion: 1, assets: {} }),
		);

		installSddAssets(packageRoot, true);

		assert.equal(readFileSync(installed, "utf8"), currentSource);
		assert.match(readFileSync(installed, "utf8"), /^tools:\n  - read$/m);
		const managedAssets = JSON.parse(
			readFileSync(
				join(temporaryAgentHome, "gentle-ai", "managed-assets.json"),
				"utf8",
			),
		) as { assets: Record<string, string> };
		assert.equal(
			managedAssets.assets["agents/sdd-apply.md"],
			createHash("sha256").update(currentSource).digest("hex"),
			"the migrated asset must record current package ownership",
		);

		installSddAssets(packageRoot, true);
		assert.equal(
			readFileSync(installed, "utf8"),
			currentSource,
			"a current package-managed asset must remain refreshable",
		);

		process.env.GENTLE_PI_AGENT_HOME = temporaryUserAgentHome;
		mkdirSync(join(temporaryUserAgentHome, "agents"), { recursive: true });
		writeFileSync(userInstalled, userEdited);
		installSddAssets(packageRoot, true);
		assert.equal(
			readFileSync(userInstalled, "utf8"),
			userEdited,
			"a user-edited variant of the malformed legacy asset must remain untouched",
		);
	} finally {
		if (previousAgentHome === undefined) delete process.env.GENTLE_PI_AGENT_HOME;
		else process.env.GENTLE_PI_AGENT_HOME = previousAgentHome;
		rmSync(temporaryAgentHome, { recursive: true, force: true });
		rmSync(temporaryUserAgentHome, { recursive: true, force: true });
	}
});

test("forced asset refresh migrates only untouched v0.14 package contracts and preserves user edits", () => {
	const packageRoot = join(import.meta.dirname, "..");
	const fixture = readFileSync(
		join(packageRoot, "tests", "fixtures", "v0.14", "assets", "agents", "review-risk.md"),
		"utf8",
	);
	const temporaryAgentHome = mkdtempSync(join(tmpdir(), "gentle-pi-v014-preflight-"));
	const previousAgentHome = process.env.GENTLE_PI_AGENT_HOME;
	const untouched = join(temporaryAgentHome, "agents", "review-risk.md");
	const edited = join(temporaryAgentHome, "agents", "review-readability.md");
	try {
		process.env.GENTLE_PI_AGENT_HOME = temporaryAgentHome;
		mkdirSync(join(temporaryAgentHome, "agents"), { recursive: true });
		writeFileSync(untouched, fixture);
		writeFileSync(edited, `${fixture}\nuser-owned edit\n`);

		installSddAssets(packageRoot, true);

		assert.match(readFileSync(untouched, "utf8"), /initial_review_tree/);
		assert.equal(readFileSync(edited, "utf8"), `${fixture}\nuser-owned edit\n`);
	} finally {
		if (previousAgentHome === undefined) delete process.env.GENTLE_PI_AGENT_HOME;
		else process.env.GENTLE_PI_AGENT_HOME = previousAgentHome;
		rmSync(temporaryAgentHome, { recursive: true, force: true });
	}
});
