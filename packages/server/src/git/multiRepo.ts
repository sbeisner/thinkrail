import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { GitDiffScope, Workspace } from "@thinkrail/contracts";
import { CodedError } from "@thinkrail/shared/codedError";

function hasGitEntry(dir: string): boolean {
	const entry = lstatSync(join(dir, ".git"), { throwIfNoEntry: false });
	return entry !== undefined && (entry.isDirectory() || entry.isFile());
}

export function childRepos(folder: string): string[] {
	let names: string[];
	try {
		names = readdirSync(folder, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
			.map((entry) => entry.name);
	} catch {
		return [];
	}
	return names.filter((name) => hasGitEntry(join(folder, name))).sort();
}

export function isMultiRepoFolder(folder: string): boolean {
	return !hasGitEntry(folder) && childRepos(folder).length > 0;
}

export interface RepoRoute {
	repo: string;
	repoPath: string;
	relPath: string;
}

export function routeRepoPath(
	ws: Pick<Workspace, "worktreePath" | "multiRepo">,
	path: string,
): RepoRoute | null {
	if (!ws.multiRepo) return null;
	const normalized = path.replaceAll("\\", "/");
	const slash = normalized.indexOf("/");
	const repo = slash < 0 ? "" : normalized.slice(0, slash);
	if (!repo || !childRepos(ws.worktreePath).includes(repo)) return null;
	return { repo, repoPath: join(ws.worktreePath, repo), relPath: normalized.slice(slash + 1) };
}

export function assertMultiRepoScope(scope: GitDiffScope | undefined): void {
	if (scope && scope.kind !== "branch" && scope.kind !== "uncommitted")
		throw new CodedError(
			"MULTI_REPO_UNSUPPORTED",
			"A multi-repo folder only shows branch and uncommitted changes",
		);
}

export function assertSingleRepo(ws: Pick<Workspace, "multiRepo">): void {
	if (ws.multiRepo)
		throw new CodedError(
			"MULTI_REPO_UNSUPPORTED",
			"This action needs a single git repository, not a multi-repo folder",
		);
}
