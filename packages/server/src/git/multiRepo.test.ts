import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Workspace } from "@thinkrail/contracts";
import { resolveDiffRange } from "./diffScope";
import { gitDiffFile, gitStatus } from "./git";
import { workspaceIgnoredPaths } from "./ignored";
import { childRepos, isMultiRepoFolder, routeRepoPath } from "./multiRepo";

let dataDir: string;
let parent: string;
const savedDataDir = process.env.THINKRAIL_DATA_DIR;

function git(cwd: string, ...args: string[]): void {
	const result = Bun.spawnSync(["git", "-C", cwd, ...args], { stdout: "ignore", stderr: "ignore" });
	if (!result.success) throw new Error(`git ${args.join(" ")} failed`);
}

function initRepo(path: string, files: Record<string, string>): void {
	mkdirSync(path, { recursive: true });
	git(path, "init", "-b", "main");
	git(path, "config", "user.email", "t@thinkrail.test");
	git(path, "config", "user.name", "test");
	git(path, "config", "commit.gpgsign", "false");
	for (const [name, content] of Object.entries(files)) writeFileSync(join(path, name), content);
	git(path, "add", "-A");
	git(path, "commit", "-m", "init");
}

const ws: Workspace = {
	id: "w1",
	projectId: "p1",
	kind: "default",
	multiRepo: true,
	name: "Default",
	branch: "",
	worktreePath: "",
	baseBranch: "",
};

beforeEach(() => {
	dataDir = mkdtempSync(join(tmpdir(), "trpi-multirepo-test-"));
	process.env.THINKRAIL_DATA_DIR = dataDir;
	parent = join(dataDir, "overwatch");
	initRepo(join(parent, "alpha"), { "a.txt": "one\n", ".gitignore": "build/\n" });
	initRepo(join(parent, "beta"), { "b.txt": "two\n" });
	mkdirSync(join(parent, "notes"));
	ws.worktreePath = parent;
	writeFileSync(join(dataDir, "workspaces.json"), JSON.stringify([ws]));
});

afterEach(() => {
	rmSync(dataDir, { recursive: true, force: true });
	if (savedDataDir === undefined) delete process.env.THINKRAIL_DATA_DIR;
	else process.env.THINKRAIL_DATA_DIR = savedDataDir;
});

test("a folder of repos is multi-repo; a repo and a plain folder are not", () => {
	expect(childRepos(parent)).toEqual(["alpha", "beta"]);
	expect(isMultiRepoFolder(parent)).toBe(true);
	expect(isMultiRepoFolder(join(parent, "alpha"))).toBe(false);
	expect(isMultiRepoFolder(join(parent, "notes"))).toBe(false);
});

test("paths route to their child repo and stay unrouted outside one", () => {
	expect(routeRepoPath(ws, "alpha/src/a.ts")).toMatchObject({
		repo: "alpha",
		repoPath: join(parent, "alpha"),
		relPath: "src/a.ts",
	});
	expect(routeRepoPath(ws, "notes/todo.md")).toBeNull();
	expect(routeRepoPath(ws, "top.md")).toBeNull();
	expect(routeRepoPath({ ...ws, multiRepo: undefined }, "alpha/a.txt")).toBeNull();
});

test("status lists every child repo's changes under its folder", async () => {
	writeFileSync(join(parent, "alpha", "a.txt"), "one\nmore\n");
	writeFileSync(join(parent, "beta", "new.txt"), "fresh\n");
	writeFileSync(join(parent, "notes", "loose.md"), "ignored outside a repo\n");

	const status = await gitStatus("w1", { kind: "uncommitted" });
	expect(status.changes).toEqual([
		{ path: "alpha/a.txt", status: "modified", added: 1, removed: 0 },
		{ path: "beta/new.txt", status: "untracked", added: 1, removed: 0 },
	]);
	expect((await gitStatus("w1")).changes.map((c) => c.path)).toEqual([
		"alpha/a.txt",
		"beta/new.txt",
	]);
});

test("a file diff reads the original side from its own child repo", async () => {
	writeFileSync(join(parent, "beta", "b.txt"), "two\nthree\n");
	const diff = await gitDiffFile("w1", "beta/b.txt", { kind: "uncommitted" });
	expect(diff.original).toBe("two\n");
	expect(diff.modified).toBe("two\nthree\n");
});

test("commit-pinned scopes and repo-wide ranges refuse a multi-repo folder", async () => {
	await expect(gitStatus("w1", { kind: "commit", sha: "abcdef0" })).rejects.toMatchObject({
		code: "MULTI_REPO_UNSUPPORTED",
	});
	await expect(resolveDiffRange(ws)).rejects.toMatchObject({ code: "MULTI_REPO_UNSUPPORTED" });
});

test("ignore marks come from each child repo's own .gitignore", async () => {
	mkdirSync(join(parent, "alpha", "build"));
	mkdirSync(join(parent, "beta", "build"));
	const ignored = await workspaceIgnoredPaths(ws, ["alpha/build", "alpha/a.txt", "beta/build"]);
	expect([...ignored]).toEqual(["alpha/build"]);
});
