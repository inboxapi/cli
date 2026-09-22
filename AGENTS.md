# CLI Agent Stub

Rust STDIO proxy that bridges JSON-RPC (MCP protocol) over STDIO to the remote InboxAPI MCP service over Streamable HTTP/SSE. Distributed as `@inboxapi/cli` on npm with platform-specific binary packages.

## Overview

- **Technology:** Rust (Tokio async runtime, reqwest HTTP client, eventsource-client SSE)
- **Protocol:** JSON-RPC over STDIO (MCP standard)
- **Transport:** HTTP POST + SSE to remote endpoint
- **Distribution:** npm with platform-specific optional dependencies
- **CI:** GitHub Actions (5-platform cross-build, GitHub Releases, npm publish)

Canonical workflow lives in `../AGENTS.md`.

## Key Files

- `src/main.rs` — Proxy loop, token injection, login flow, hashcash proof-of-work
- `index.js` — npm binary resolver (platform package → local build → `cargo run`)
- `package.json` — Root npm package with `optionalDependencies` for 5 platforms
- `npm/cli-*/package.json` — Platform-specific package manifests (`os`/`cpu` fields)
- `.github/workflows/release.yml` — Cross-build, GitHub Release, npm publish pipeline
- `Cargo.toml` — Rust project configuration and dependencies
- `tests/mcp_integration_test.rs` — Integration tests

## CLI Commands

```bash
cargo run -- proxy   # Start STDIO proxy (default)
cargo run -- login   # Authenticate and store credentials
cargo run -- whoami  # Show current account

# Email operations
cargo run -- send-email --to user@example.com --subject "Hi" --body "Hello"
cargo run -- send-email --to user@example.com --subject "Newsletter" --body-file ./body.txt --html-body-file ./newsletter.html
cargo run -- get-emails --limit 5
cargo run -- get-email "<message-id>"
cargo run -- search-emails --subject "keyword"
cargo run -- get-attachment <id> --output ./file.pdf
cargo run -- send-reply --message-id "<id>" --body "Reply"
cargo run -- send-reply --message-id "<id>" --body-file ./reply.txt --html-body-file ./reply.html
cargo run -- forward-email --message-id "<id>" --to user@example.com
cargo run -- help
```

Prefer `--body-file` and `--html-body-file` for complex HTML, templates, or large generated content. File-backed bodies are validated as UTF-8 text, normalized to `\n`, and capped at 20 MiB.

## npm Distribution

```
@inboxapi/cli              — Main package (wrapper script)
@inboxapi/cli-darwin-arm64 — macOS ARM64
@inboxapi/cli-darwin-x64   — macOS x64
@inboxapi/cli-linux-x64    — Linux x64
@inboxapi/cli-linux-arm64  — Linux ARM64
@inboxapi/cli-win32-x64    — Windows x64
```

Users install with `npm install -g @inboxapi/cli`. npm automatically selects the correct platform binary via the `os` and `cpu` fields in each platform package.

This repo owns the CLI binary, npm packaging, and agent-install setup logic.

## Verification Flow

Run these in order before committing:

1. `cargo fmt` — format code
2. `cargo clippy -- -D warnings` — lint with zero warnings
3. `cargo test` — all unit tests pass
4. `cargo build` — clean compilation
5. **Test each new CLI subcommand** — after building, run each new or modified subcommand against the live API to verify it works end-to-end (e.g. `cargo run -- get-emails --limit 3 --human`)

## Contribution Workflow

1. Create a feature branch from `main`
2. Implement changes with focused commits
3. Run the verification flow above (including live testing of CLI subcommands)
4. Open a PR against `main`

## Coding Standards

### Rust
- Implement `Drop` for structs owning child processes or OS resources — panics must not leak processes
- Never re-create `BufReader` in a loop or per-call; store it in the struct so buffered data is not lost
- Use iterators (`iter().take(n)`) instead of index-based `for i in 0..n` loops when only indexing a single collection
- Add timeouts to all blocking I/O (network, subprocess reads) — tests and tools must not hang indefinitely
- Include descriptive messages in all `assert!` / `assert_eq!` macros

### JavaScript / Node.js
- Never use `execSync` / `execFileSync` with string interpolation — pass arguments as arrays to avoid shell injection
- Do not mark synchronous functions `async` — it is misleading and wraps the return in an unnecessary Promise
- Handle chunked `data` events from child process stdout with line-based parsing (e.g. `readline.createInterface`), not raw `JSON.parse` on each chunk
- When communicating with a subprocess over its lifetime, spawn it once and reuse the connection — do not spawn a new process per request
- Validate all user input (bounds checks, type checks) before using it to index arrays or build commands
- Centralize model identifiers in a single constant or environment variable; avoid scattering hardcoded dated model version strings throughout the code

### MCP Protocol
- After sending `initialize`, always send `notifications/initialized` before any other requests — skipping this violates the MCP handshake and may cause server rejection

## Release & Publishing

Publishing is fully automated via GitHub Actions. To release a new version:

1. **Bump the version** in `Cargo.toml` to the new `MAJOR.MINOR.PATCH`
2. **Tag the commit**: `git tag vMAJOR.MINOR.PATCH`
3. **Push the tag**: `git push origin vMAJOR.MINOR.PATCH`

This triggers the CI pipeline which:
- Builds the binary for 5 platforms (Linux x64/arm64, macOS x64/arm64, Windows x64)
- Creates a GitHub Release with all binaries and a `SHA256SUMS` file
- Publishes platform-specific npm packages (`@inboxapi/cli-darwin-arm64`, etc.)
- Publishes the main `@inboxapi/cli` package (waits for platform packages to be visible on npm first)

No manual npm publish step is needed — the tag is the trigger.

## General Rules

- Do not add AI attribution to commits, code, or comments
- Run `cargo fmt` before committing Rust changes
- Use conventional commits (`feat:`, `fix:`, `chore:`, etc.)
