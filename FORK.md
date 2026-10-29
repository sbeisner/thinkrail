# About this fork

This is a fork of [JetBrains/thinkrail](https://github.com/JetBrains/thinkrail) with two additions:

1. **Multi-repo folders.** You can open a folder that isn't a git repo but holds several (for example
   `~/code/overwatch` with `overwatch-core`, `overwatch-dashboard`, …) as one project.
2. **Claude through an Anthropic API key.** Setup notes for using Claude models with a key from your
   organization's Anthropic Console.

Upstream changes come in with `git fetch upstream && git merge upstream/main`.

## Multi-repo folders

A folder opens as a **multi-repo project** when it has no `.git` of its own and at least one immediate
child folder does. Open it like any other project (**Add project → Open folder…**, or `thinkrail ~/code/overwatch`).

How it behaves:

- **The agent works in the parent folder.** Chats, terminals and the Files tree are rooted at
  `~/code/overwatch`, so one conversation can read and change every repo.
- **Only the project folder is available.** Worktree workspaces are turned off, because one branch can't
  span several repositories. **New workspace**, **Open existing worktree** and `Cmd/Ctrl+N` are hidden,
  and **Start building** chats open in the project folder.
- **Changes are grouped by repo.** The Changes view lists each repo's files under its folder
  (`overwatch-core/src/…`). **All changes** compares each repo against its own default branch, and
  **Uncommitted** shows each repo's working tree. Diffs, reverting a hunk, and gitignore dimming in the
  Files tree all work per repo.
- **There are no branch or PR controls.** The topbar's branch, push and PR controls are hidden, because each
  repo has its own branch. Commit, push and open PRs from a terminal or by asking the agent. It can run
  `git -C overwatch-core …` or `gh` in each repo.
- **These aren't available yet:** single-commit and pinned-base diff scopes, **Last turn** change sets, and
  review comments on the base side of a diff.

Repos added to or removed from the folder later are picked up automatically, because child repos are
re-listed on every status read.

## Claude with an Anthropic API key

ThinkRail runs the [`pi`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) agent, which can
call Claude with an Anthropic API key. Use a key from your organization's
[Anthropic Console](https://console.anthropic.com/settings/keys). A Team plan admin can create one, or create
a workspace for you to make your own. API usage is billed to the Console organization, separately from
Team plan seats.

Pick one way to provide the key:

- **In the app:** open **Settings → Providers**, find **Anthropic** under **Available**, choose
  **API key**, and paste the key. pi stores it in `~/.pi/agent/auth.json`.
- **Environment variable:** set `ANTHROPIC_API_KEY` in **Settings → Environment**, or export it before
  launching (`ANTHROPIC_API_KEY=sk-ant-… thinkrail`).
- **From the pi CLI:** if you also use `pi` in a terminal, a key you log in with there is picked up
  automatically, since both read `~/.pi/agent`.

Then pick a Claude model in the chat's model picker.

**Don't use the Claude entry under Settings → Providers → Subscriptions with a Claude Team or Pro/Max
plan.** That option signs in with your Claude.ai subscription through OAuth. Anthropic's terms limit subscription OAuth tokens to Claude Code
and Claude.ai, so using one in a third-party tool can put your organization's seats at risk. The API-key
route above is the supported way for a third-party tool like this one to use Claude.
