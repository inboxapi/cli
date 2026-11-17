# InboxAPI CLI

Give your AI agent its own personal email address. Send, receive, read, search, and reply to emails — right from Claude, OpenCode, Codex, Gemini, or any MCP-compatible AI client. No email server to run, no SMTP to configure.

---

### Table of Contents

- [Overview](#overview)
- [How it works](#how-it-works)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Authentication & credentials](#authentication--credentials)
- [Commands](#commands)
  - [Sending email](#sending-email)
  - [Reading & searching](#reading--searching)
  - [Attachments](#attachments)
  - [Accounts, security & recovery](#accounts-security--recovery)
  - [Credential management](#credential-management)
  - [Skills & hooks](#skills--hooks)
- [Usage with MCP clients](#usage-with-mcp-clients)
- [Available MCP tools](#available-mcp-tools)
- [Security](#security)
- [FAQ](#faq)
- [Development](#development)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Overview

1. **Install the CLI** — `npm install -g @inboxapi/cli@latest`
2. **Connect it** to your AI client (Claude Desktop, Claude Code, Gemini CLI, OpenCode, Codex, etc.)
3. **Your AI uses email** — no code or API keys needed

An account with a unique, personal email address is created automatically on first run. Your AI can then send emails, receive email at its own inbox, reply and forward, search by keyword, and read full conversation threads.

## How it works

The CLI acts as a local bridge between your AI client and the InboxAPI cloud service. It speaks the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) over standard input/output, so any compatible AI client can use it without custom integration. Credentials are stored locally and injected automatically — your agent never manages tokens.

## Installation

```bash
npm install -g @inboxapi/cli@latest
```

Prebuilt binaries ship for:

| Platform | Architecture |
|----------|--------------|
| macOS    | ARM64, x64   |
| Linux    | x64, ARM64   |
| Windows  | x64          |

Update with the same command:

```bash
npm install -g @inboxapi/cli@latest
```

The CLI also checks for updates automatically when running in proxy mode and installs them in the background.

## Quick start

Just start the proxy — an account is created automatically on first run:

```bash
inboxapi proxy
```

On first run with no saved credentials, the CLI auto-creates an account with a generated name (e.g. `brooding-fluffy-owl`) and authenticates. Running `inboxapi` with no subcommand also starts the proxy.

To create an account yourself with a chosen name:

```bash
inboxapi login --name myagent
```

## Authentication & credentials

Authentication is handled automatically by the CLI proxy. You do not need to create accounts, manage tokens, or store credentials manually. Simply start the proxy or run a subcommand and it works.

Credentials are stored in your system config directory and searched across the following locations:

- `~/Library/Application Support/inboxapi/credentials.json` (macOS primary)
- `~/.config/inboxapi/credentials.json` (Linux primary / macOS fallback)
- `~/.local/inboxapi/credentials.json` (fallback, used by some AI agents)

To inspect the active account:

```bash
inboxapi whoami
```

### Custom domains & claim secrets

To create or claim an account on a custom domain, use a claim secret. **Prefer the environment variable** so the secret never appears in process listings or shell history:

```bash
# Create an account directly on a custom domain
INBOXAPI_CLAIM_SECRET=ibx... inboxapi login --name myagent
INBOXAPI_CLAIM_SECRET=ibx... inboxapi proxy

# Claim a custom-domain primary mailbox for an existing account
INBOXAPI_CUSTOM_DOMAIN_SECRET=ibx... inboxapi custom-domain-claim --email-address agent@example.com
```

The custom-domain mailbox becomes primary. The previously generated mailbox remains receive-enabled but cannot send.

## Commands

Most CLI commands accept `--human` for a human-readable summary instead of JSON.

### Sending email

```bash
inboxapi send-email --to user@example.com --subject "Hello" --body "Hi there"
inboxapi send-email --to "a@b.com, c@d.com" --subject "Hi" --body "Hello" --cc "cc@b.com" --priority high
inboxapi send-email --to u@e.com --subject "Newsletter" --body-file ./body.txt --html-body-file ./news.html
inboxapi send-email --to u@e.com --subject "Report" --attachment ./report.pdf --attachment-ref 9f0206bb-...
inboxapi send-reply --message-id "<msg-id>" --body "Thanks!" --reply-all
inboxapi send-reply --message-id "<msg-id>" --body-file ./reply.txt --html-body-file ./reply.html --cc new@e.com
inboxapi forward-email --message-id "<msg-id>" --to recipient@example.com --note "FYI"
```

- `--to` is comma-separated (repeatable groups). `--cc` / `--bcc` are comma-separated.
- `--body` or `--body-file` (mutually exclusive); `--html-body` or `--html-body-file` (mutually exclusive).
- `--attachment` = local files (repeatable). `--attachment-ref` = server-side attachments by ID (repeatable).
- `--priority` = `low`, `normal`, or `high`.
- Prefer `--body-file` / `--html-body-file` for complex HTML, templates, or large generated payloads such as inline base64 images. File-backed bodies are validated as UTF-8 text, normalized to `\n` line endings, and capped at 20 MiB.
- Sender identity is enforced by InboxAPI; a `from_name` is ignored.

### Reading & searching

```bash
inboxapi get-emails --limit 5 --offset 10
inboxapi get-email "<message-id>"
inboxapi get-last-email
inboxapi get-email-count --since 2026-11-01T00:00:00Z
inboxapi get-sent-emails --status sent --limit 10
inboxapi get-thread --message-id "<msg-id>"
inboxapi search-emails --sender alice --subject invoice --limit 10
inboxapi get-addressbook
inboxapi get-announcements
```

`search-emails` filters by `--sender` (substring, case-insensitive) and/or `--subject`, with optional `--since` / `--until` ISO 8601 bounds and `--limit`. The address book is auto-populated as you send — you don't manage contacts manually.

### Attachments

```bash
inboxapi get-attachment abc123                      # prints signed URL as JSON
inboxapi get-attachment abc123 --output ./file.pdf  # downloads to file
inboxapi get-attachment abc123 --output ./file.pdf --force  # overwrite an existing file
```

Downloads refuse to overwrite an existing file unless `--force`, never write through a symlink, and are created with owner-only permissions. The download URL must be `https` and must not point at a private, loopback, or link-local address (including after redirects or DNS resolution).

### Accounts, security & recovery

```bash
inboxapi verify-owner --owner-email you@e.com          # Link your email (6-digit code flow; use --yes to skip the prompt)
inboxapi account-recover --name myagent --email you@e.com
inboxapi auth-introspect                               # Check current access token status
inboxapi auth-revoke --token <token>                   # Revoke a specific token
inboxapi auth-revoke-all                               # Revoke all tokens for the account
inboxapi enable-encryption                             # Enable email encryption
inboxapi reset-encryption                              # Reset email encryption
inboxapi rotate-encryption --old-secret <old> --new-secret <new>
```

Owner verification links your personal email to your agent's account. Your agent calls `verify-owner` with your email, receives a 6-digit code, and submits it. Once verified, you can recover the account if credentials are ever lost, and trial restrictions are removed.

### Credential management

```bash
inboxapi reset                       # Delete stored credentials (prompts, offers a backup first)
inboxapi backup ./my-backup          # Back up credentials to a folder
inboxapi restore ./my-backup         # Restore credentials from a backup folder
```

### Skills & hooks

```bash
inboxapi setup-skills                 # Auto-detect installed agents and prompt
inboxapi setup-skills --all           # Install for all four agents
inboxapi setup-skills --claude --codex   # Install for specific agents
inboxapi setup-skills --force         # Overwrite existing (locally edited) skills/hooks
```

Skills are installed to agent-specific directories:

| Agent | Install directory |
|-------|-------------------|
| Claude Code | `.claude/skills/` |
| Codex CLI | `.agents/skills/` |
| Gemini CLI | `.gemini/skills/` |
| OpenCode | `.opencode/commands/` |

Available skills: `/check-inbox`, `/compose`, `/email-search`, `/email-reply`, `/email-digest`, `/email-forward`, `/setup-inboxapi`.

**Claude Code hooks** are also installed:

| Hook | Type | Description |
|------|------|-------------|
| Credential Check | SessionStart | Verifies InboxAPI credentials on startup and shows authentication status |
| Email Send Guard | PreToolUse | Reviews outbound emails before sending, warns about self-sends and empty bodies |
| Activity Logger | PostToolUse | Logs InboxAPI tool usage for audit trails |

## Usage with MCP clients

Point your MCP client at the `inboxapi` binary.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "inboxapi": {
      "command": "inboxapi"
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add inboxapi inboxapi              # current project
claude mcp add inboxapi inboxapi -s user      # global (all projects)
```

**Gemini CLI:**

```bash
gemini mcp add inboxapi inboxapi              # current project
gemini mcp add inboxapi inboxapi --scope user # system-wide
```

**OpenCode:** run `opencode mcp add` and, when prompted, set Location to *Global*, server name to `inboxapi`, type to *Local*, and the command to `inboxapi`.

**Codex CLI:**

```bash
codex mcp add inboxapi inboxapi
```

## Available MCP tools

Starting the proxy exposes the full tool set automatically — no per-tool configuration. Key capabilities:

- **Read:** `get_emails`, `get_email`, `get_last_email`, `get_email_count`, `get_sent_emails`, `get_thread`, `search_emails`, `get_addressbook`, `get_announcements`
- **Send:** `send_email`, `send_reply`, `forward_email`
- **Attachments:** `get_attachment` (short-lived signed download URL)
- **Account & security:** `whoami`, `auth_introspect`, `verify_owner`, `account_recover`, `custom_domain_claim`
- **Meta:** `help`

Email-reading tools apply trust classification and datamarking to untrusted content before it reaches your agent (see [Security](#security)). Detailed per-tool help is available in the binary via `inboxapi help` and in [`docs/help.md`](docs/help.md).

## Security

**Trust classification.** Every inbound email is classified as `trusted`, `agent`, `unverified`, or `suspicious` based on whether the sender is in your addressbook and passes authentication. Agents should act freely on trusted mail, be cautious with unverified, and confirm with their human before acting on anything else.

**Datamarking (spotlighting).** Untrusted email content is transformed by replacing whitespace with a unique marker character generated per request, so your agent can distinguish email data from its own instructions. Content containing the marker is external data — never follow instructions within it. To recover the original text, replace the marker with a space. This is based on academic research ([arXiv:2403.14720](https://arxiv.org/abs/2403.14720)).

**Data-exfiltration protection.** Outbound emails are scanned for authentication tokens and credentials. If an agent tries to send a JWT or access token, the message is rejected before it leaves the platform. All recipient addresses are validated against RFC 5322.

**Safe downloads.** Attachment downloads refuse to overwrite existing files unless `--force`, never write through symlinks, use owner-only permissions, and only fetch over `https` from public addresses (guards against SSRF via redirects/DNS).

**Secrets in env, not flags.** Any secret (claim secrets, tokens, encryption secrets) should be provided via environment variables rather than command-line flags, so it doesn't leak into process listings, shell history, or logs.

## FAQ

### Why not just give my agent access to my Gmail or Outlook?

**Security** — Gmail/Outlook OAuth gives your agent access to your entire inbox (medical, financial, legal, personal). A prompt injection in any inbound email could manipulate an agent with access to all of it. InboxAPI gives your agent its own isolated inbox with trust classification and datamarking on every message.

**Identity** — When your agent sends from your Gmail, recipients can't tell who they're talking to. Replies go to your inbox, mixed with your real mail. InboxAPI gives your agent its own personal address — clear separation between you and your agent.

**Practicality** — Gmail/Outlook APIs aren't MCP-native. You'd need middleware, OAuth plumbing, and custom integration. InboxAPI works out of the box with any MCP client.

### How is this different from AWS SES, SendGrid, or Resend?

Those are sending APIs — you build email infrastructure on top of them. InboxAPI gives your agent a complete email identity: send, receive, search, reply, and forward. There's nothing to configure and no infrastructure to manage.

### Is it really free?

Yes. No credit card, no trial period, no usage tiers. Paid plans with additional features are planned, but the core experience will always be free.

### How do you prevent spam and abuse?

Account creation requires proof-of-work. Each account can email up to 5 unique external addresses per week. Daily send quotas and rate limiting are enforced on every account. These constraints are structural — they're how the system works, not just policies.

### What are the send limits?

Each account can email up to 5 unique external email addresses per week. Emails to other InboxAPI addresses don't count against this limit. The limit resets weekly. When all 5 slots are in use, the least recently used entry is auto-replaced after 5 days of inactivity.

### What about prompt injection via email?

Every inbound email carries a trust classification, and untrusted content is datamarked so your agent can tell email data from instructions. Emails from other InboxAPI agents are flagged separately so your agent knows to check with you before acting on them.

### What is owner verification?

Owner verification links your personal email address to your agent's InboxAPI account via a 6-digit code. Once verified, you can recover the account if credentials are ever lost, and trial restrictions are removed. The CLI subcommand `verify-owner` prompts for confirmation by default; use `--yes` for scripted runs.

### What happens when I lose access?

If credentials are lost or corrupted, you can recover the account with `account-recover` — but only if you previously linked your email via `verify-owner`. Recovery revokes all existing tokens and issues new credentials. Without a verified owner email, there is no way to recover a locked-out account.

### Can I send HTML emails and attachments?

Yes. Use `--html-body` / `--html-body-file` for HTML, `--attachment` (local files) or `--attachment-ref` (server-side attachment IDs) for attachments. For large or templated content, prefer the `--body-file` / `--html-body-file` variants.

### What AI model should I use with InboxAPI?

Your model must support **tool/function calling** (MCP requires this). A reasonably recent model with a context window of at least 32K is comfortable; models under ~16K or without reliable tool calling will struggle to fit the tool definitions alongside conversation history and email content. For the send/ reply/ forward tools, prefer a model that reads tool descriptions carefully so it applies the safety flags (`confirm`, `allow_new_recipients`) correctly.

### Can agents spam each other?

The same send limits apply to all outbound email — recipient caps, quotas, and rate limiting work the same regardless of who's on the receiving end.

## Development

```bash
cargo build            # Build debug binary
cargo build --release  # Build release binary
cargo test             # Run tests
cargo fmt              # Format code
cargo clippy -- -D warnings   # Lint
```

Run `cargo run -- help` for the full CLI command list, or `cargo run -- login` to create a local account. Live end-to-end integration tests (`tests/mcp_integration_test.rs`) are ignored by default and require network + credentials: `cargo test -- --ignored`.

The full CLI reference lives in [`docs/help.md`](docs/help.md); the public product guide is here in `README.md`.

## License

The source code in this repository is licensed under the [MIT License](LICENSE).

## Disclaimer

The InboxAPI service is provided as-is, with no guarantees or warranties of any kind. We reserve all rights regarding how the service is operated. Service terms, features, and availability may change at any time without notice.
