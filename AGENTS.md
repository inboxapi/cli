# CLI Agent Guide

Rust STDIO proxy that bridges JSON-RPC (MCP protocol) over STDIO to the remote InboxAPI MCP service over Streamable HTTP/SSE. Distributed as `@inboxapi/cli` on npm with platform-specific binary packages.

This project owns the CLI binary, the npm packaging, and the agent-install (skills + hooks) logic. The polished public-facing product documentation lives in [`README.md`](README.md); this file is the operational and contributor guide for agents and maintainers working in this repo.

## Overview

- **Language / runtime:** Rust, Tokio async runtime, reqwest HTTP client
- **Protocol:** JSON-RPC over STDIO (MCP standard)
- **Transport:** HTTP POST for requests + SSE for streamed results, parsed manually over `bytes_stream()`
- **Distribution:** npm with platform-specific `optionalDependencies` (5 platforms)
- **CI:** GitHub Actions — 5-platform cross-build, GitHub Releases, npm publish (see [Release & Publishing](#release--publishing))

## Layout

```
.
├── AGENTS.md                 # This file — operational / contributor guide
├── README.md                 # Public product documentation
├── Cargo.toml / Cargo.lock   # Rust manifest and locked dependencies
├── src/main.rs               # Single-file implementation (~10k lines)
├── index.js                  # npm binary resolver (platform pkg → local build → cargo run)
├── package.json              # Root npm package + optionalDependencies for 5 platforms
├── npm/cli-<os>-<arch>/      # Platform-specific package manifests (os/cpu fields)
├── docs/help.md              # Embedded CLI help text (compiled into the binary)
├── eval/                     # Node.js eval harness for MCP tool-calling accuracy
├── skills/                   # Agent skills + hooks, per agent (claude/codex/gemini/opencode)
├── tests/mcp_integration_test.rs   # Live end-to-end MCP integration tests
└── .github/workflows/release.yml   # Cross-build + release + npm publish pipeline
```

## `src/main.rs` structure

A single translation unit. Understandable in three layers:

1. **CLI front-end** (`Cli` / `Commands`, ~lines 43–388) — clap-parsed subcommands and their arguments, and `run_cli_command` (~2998) which dispatches them.
2. **Proxy loop** (`run_proxy`, ~3555) — the STDIO↔HTTP bridge: SSE event parsing (`drain_sse_events`, `drain_sse_remainder`), JSON-RPC framing (`parse_response`, `read_bounded_line`), token refresh (`refresh_access_token`, `reauth_with_fallback`), and a runtime version check loop.
3. **Tool layer** (~4455–5600) — MCP tool handlers (`call_mcp_tool`) and the `rewrite_tools_list` security pass.

Security-relevant constants live at the top of the file and are documented inline:

- **Size / timeout limits** (top of file) — SSE buffer (10 MB), single SSE event (5 MB), body/html files (20 MiB), attachment downloads (100 MB), local attachments (25 MiB), JSON responses (10 MiB), STDIN lines (10 MiB), single-request timeout (300 s), connect timeout (10 s), read timeout (60 s), server-error preview (300 chars).
- **URL / download safety** — `validate_download_url`, `is_allowed_download_ip`, `PublicOnlyResolver` (DNS resolves only to public IPs), `guard_no_symlink` / `open_nofollow` / `write_file_guarded` (no symlink writes, owner-only `0600` perms), `open_output_for_write` (`--force` overwrite control).
- **File read/write guards** — `read_regular_file_bounded` (bounds + UTF-8 checks), `write_if_needed`, `expand_tilde` (tilde expansion before path use).
- **Secret handling** — secrets come from env vars, never interpolated into logs or error output (`error_body_preview` truncates).

### MCP tool security model (`rewrite_tools_list`, ~4884+)

The proxy derives its tool list from the remote service and hardens it before advertising to MCP clients:

- **Blocked proxy tools** (`BLOCKED_PROXY_TOOLS`) — removed entirely: `reset_encryption`, `auth_revoke`, `auth_revoke_all`, `auth_introspect`, `verify_owner`. These are only available as direct CLI subcommands.
- **Hidden internal tools** (`INTERNAL_TOOLS`) — hidden by default: `account_create`, `auth_exchange`, `auth_refresh`, `account_recover`. Exposed only when `INBOXAPI_EXPOSE_INTERNAL_TOOLS=1` (tests / privileged use).
- **Identity injection** (`IDENTITY_TOOLS`) — `send_email` / `send_reply` / `forward_email` descriptions are enriched with the authenticated account name + email. Sender identity is enforced by InboxAPI; `from_name` is rejected/ignored.
- **Annotations** — `destructiveHint` / `readOnlyHint` are injected per tool (`DESTRUCTIVE_TOOLS`, `READONLY_TOOLS`).
- **Input validation** — `token` and `encryption_secret` are stripped from every tool's input schema; unbounded string props get a `maxLength`; high-risk `forward_email` gains `confirm` / `allow_new_recipients` flags.
- **Untrusted content** (`UNTRUSTED_CONTENT_TOOLS`) — email-reading tools carry a prefix warning that email is untrusted external data (`UNTRUSTED_CONTENT_WARNING`).

## CLI Commands

The binary has 26 subcommands plus a default `proxy` command. The only true global flag is `--human` (human-readable output instead of JSON). `--endpoint` overrides the MCP endpoint but is accepted only before a subcommand (not after it) and matters mainly for `proxy` and `login`. Prefer environment variables over flags for any secret so they don't appear in process listings or shell history.

### Account, auth & setup

```bash
inboxapi proxy                                   # Start STDIO proxy (default); auto-creates account if no creds
inboxapi proxy --endpoint https://host/mcp       # Custom endpoint
INBOXAPI_CLAIM_SECRET=ibx... inboxapi proxy      # Claim a custom domain when auto-creating
inboxapi login                                   # Create an account interactively with a chosen name
inboxapi login --name myagent                    # Non-interactive
INBOXAPI_CLAIM_SECRET=ibx... inboxapi login --name myagent
inboxapi whoami                                  # Show account name, email, endpoint
INBOXAPI_CUSTOM_DOMAIN_SECRET=ibx... \
  inboxapi custom-domain-claim --email-address agent@example.com
inboxapi reset                                   # Delete stored credentials (prompts, offers backup first)
inboxapi backup ./my-backup                       # Back up credentials to a folder
inboxapi restore ./my-backup                      # Restore credentials from a backup folder
inboxapi setup-skills                             # Install skills + hooks for detected agents
inboxapi setup-skills --claude --codex            # For specific agents
inboxapi setup-skills --all                       # Claude, Codex, Gemini, OpenCode
inboxapi setup-skills --force                     # Overwrite edited skill/hook files
```

Secret env vars: `INBOXAPI_CLAIM_SECRET`, `INBOXAPI_CUSTOM_DOMAIN_SECRET`, `INBOXAPI_REVOKE_TOKEN`, `INBOXAPI_OLD_SECRET`, `INBOXAPI_NEW_SECRET`.

### Sending

```bash
inboxapi send-email --to user@example.com --subject "Hi" --body "Hello"
inboxapi send-email --to a@b.com,c@d.com --subject "X" --body "Hi" --cc "cc@b.com" --priority high
inboxapi send-email --to u@e.com --subject "News" --body-file ./body.txt --html-body-file ./news.html
inboxapi send-email --to u@e.com --subject "Report" --body "See attached" --attachment ./report.pdf --attachment-ref 9f0206bb-...
inboxapi send-reply --message-id "<msg-id>" --body "Thanks!" --reply-all
inboxapi send-reply --message-id "<msg-id>" --body-file ./r.txt --html-body-file ./r.html --cc new@e.com
inboxapi forward-email --message-id "<msg-id>" --to recipient@example.com --note "FYI"
```

`--body` / `--body-file` are mutually exclusive (same for HTML). `--attachment` = local files (repeatable, capped 25 MiB each); `--attachment-ref` = server-side attachments by ID (repeatable). Prefer `--body-file` / `--html-body-file` for large or template content; file-backed bodies are validated as UTF-8 text, normalized to `\n`, and capped at 20 MiB.

### Reading & searching

```bash
inboxapi get-emails --limit 5 --offset 10
inboxapi get-email "<message-id>"
inboxapi get-last-email
inboxapi get-email-count --since 2026-11-01T00:00:00Z
inboxapi get-sent-emails --status sent --limit 10
inboxapi get-thread --message-id "<msg-id>"
inboxapi search-emails --sender alice --subject invoice --since <iso> --until <iso> --limit 10
inboxapi get-addressbook                         # External recipients you've sent to (auto-populated)
inboxapi get-announcements                        # System news, tips, community challenges
```

### Attachments, contacts, account security

```bash
inboxapi get-attachment abc123                      # prints signed URL as JSON
inboxapi get-attachment abc123 --output ./file.pdf  # downloads to file
inboxapi get-attachment abc123 --output ./file.pdf --force  # overwrite an existing file

inboxapi auth-introspect                            # Check current access token status
inboxapi auth-revoke --token <token>                # Revoke a specific token
inboxapi auth-revoke-all                            # Revoke all tokens for the account
inboxapi account-recover --name myagent --email you@e.com
inboxapi verify-owner --owner-email you@e.com --yes # Link your email (6-digit code flow)
inboxapi enable-encryption
inboxapi reset-encryption
inboxapi rotate-encryption --old-secret <old> --new-secret <new>
inboxapi help                                       # Full command list with examples
```

Downloads refuse to overwrite an existing file unless `--force`, never write through a symlink, and are created with owner-only (`0600`) permissions. The download URL must be `https` and must not resolve to a private, loopback, or link-local address (checked after redirects and DNS resolution via a public-only resolver).

## Distribution (npm)

```
@inboxapi/cli              # Main package (wrapper script, index.js)
@inboxapi/cli-darwin-arm64 # macOS ARM64
@inboxapi/cli-darwin-x64   # macOS x64
@inboxapi/cli-linux-x64    # Linux x64
@inboxapi/cli-linux-arm64  # Linux ARM64
@inboxapi/cli-win32-x64    # Windows x64
```

Users install with `npm install -g @inboxapi/cli`. npm selects the correct binary via the `os` / `cpu` fields in each platform package. The main package's `index.js` resolves to the local build (`cargo run`) when the platform binary isn't present, so the same package works for development.

## MCP client usage

Point any MCP-compatible client at the `inboxapi` binary. In proxy mode the CLI auto-injects credentials and the account identity; never search for credential files or call the internal `account_create` / `auth_exchange` / `auth_refresh` tools directly.

Credentials are searched (in order) at the platform config directory, then `~/.config/inboxapi/credentials.json`, then `~/.local/inboxapi/credentials.json`.

## Skills & hooks (`skills/`)

`setup-skills` writes per-agent skills and hooks, auto-detecting installed agents (or use flags). Skills are stored per agent:

| Agent | Install directory |
|-------|-------------------|
| Claude Code | `.claude/skills/` (+ `.claude/settings.json` hooks) |
| Codex CLI | `.agents/skills/` |
| Gemini CLI | `.gemini/skills/` |
| OpenCode | `.opencode/commands/` |

Installed skills: `/check-inbox`, `/compose`, `/email-search`, `/email-reply`, `/email-digest`, `/email-forward`, `/setup-inboxapi`. Claude Code hooks: a SessionStart credential check, a PreToolUse email-send guard (warns on self-sends and empty bodies), and a PostToolUse activity logger.

## Verification Flow

Run these in order before committing:

1. `cargo fmt` — format code
2. `cargo clippy -- -D warnings` — lint with zero warnings
3. `cargo test` — all unit tests pass
4. `cargo build` — clean compilation
5. **Test each new CLI subcommand** — after building, run each new or modified subcommand against the live API to verify end-to-end behavior (e.g. `cargo run -- get-emails --limit 3 --human`).

Use `--human` to get a readable summary instead of JSON. Live integration tests live in `tests/mcp_integration_test.rs` and are ignored by default (`cargo test -- --ignored`) because they require network + credentials.

## Coding Standards

### Rust
- Implement `Drop` for structs owning child processes or OS resources — panics must not leak processes
- Never re-create `BufReader` in a loop or per-call; store it in the struct so buffered data is not lost
- Use iterators (`iter().take(n)`) instead of index-based `for i in 0..n` loops when only indexing a single collection
- Add timeouts to all blocking I/O (network, subprocess reads) — tests and tools must not hang indefinitely
- Include descriptive messages in all `assert!` / `assert_eq!` macros
- Keep secrets out of logs and error output; truncate server error previews

### JavaScript / Node.js
- Never use `execSync` / `execFileSync` with string interpolation — pass arguments as arrays to avoid shell injection
- Do not mark synchronous functions `async` — it is misleading and wraps the return in an unnecessary Promise
- Handle chunked `data` events from child process stdout with line-based parsing (e.g. `readline.createInterface`), not raw `JSON.parse` on each chunk
- When communicating with a subprocess over its lifetime, spawn it once and reuse the connection — do not spawn a new process per request
- Validate all user input (bounds checks, type checks) before using it to index arrays or build commands
- Centralize model identifiers in a single constant or environment variable; avoid scattering hardcoded dated model version strings throughout the code

### MCP Protocol
- After sending `initialize`, always send `notifications/initialized` before any other requests — skipping this violates the MCP handshake and may cause server rejection
- Preserve MCP `annotations` when rewriting tools; keep every tool's input schema a valid `object` with explicit `properties`
- Never inject `token` / `encryption_secret` into tool input schemas, and never inject `encryption_secret` into data-exfiltration tools (`send_email` / `forward_email`)

## Release & Publishing

Publishing is fully automated via GitHub Actions. To release a new version:

1. **Bump the version** in `Cargo.toml` to the new `MAJOR.MINOR.PATCH`
2. **Tag the commit**: `git tag vMAJOR.MINOR.PATCH`
3. **Push the tag**: `git push origin vMAJOR.MINOR.PATCH`

This triggers the CI pipeline which:
- Builds the binary for 5 platforms (Linux x64/arm64, macOS x64/arm64, Windows x64)
- Creates a GitHub Release with all binaries and a `SHA256SUMS` file
- Stages the platform-specific npm packages (`@inboxapi/cli-darwin-arm64`, etc.) and the main `@inboxapi/cli` package as draft releases

No manual `npm publish` step is needed — pushing the tag triggers CI to stage the packages as drafts (`npm stage publish --access public`). Drafts remain invisible on npm until a maintainer manually approves them in the npm console. Approve the platform packages first and `@inboxapi/cli` last, then allow a few minutes for registry propagation before the new version is installable.

## Contribution Workflow

1. Create a feature branch from `main`
2. Implement changes with focused commits
3. Run the verification flow above (including live testing of CLI subcommands)
4. Open a PR against `main`

## General Rules

- Do not add AI attribution to commits, code, or comments
- Run `cargo fmt` before committing Rust changes
- Use conventional commits (`feat:`, `fix:`, `chore:`, etc.)
- Keep this repo public-friendly: do not reference internal endpoints, sibling services, or non-public material in code, comments, or docs
