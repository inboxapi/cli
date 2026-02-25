# InboxAPI CLI

STDIO proxy that bridges the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) over STDIO to the remote [InboxAPI](https://inboxapi.ai) service over Streamable HTTP/SSE. This lets any MCP-compatible client (Claude Desktop, Claude Code, etc.) use InboxAPI's email tools without custom HTTP integration.

## Installation

```bash
npm install -g @inboxapi/cli
```

Prebuilt binaries are included for:

| Platform       | Architecture |
|----------------|--------------|
| macOS          | ARM64, x64   |
| Linux          | x64, ARM64   |
| Windows        | x64          |

## Getting Started

```bash
# Create an account and authenticate
inboxapi login

# Start the proxy (reads JSON-RPC from stdin, forwards to InboxAPI)
inboxapi proxy
```

After logging in, credentials are stored in your system config directory (`~/.config/inboxapi/credentials.json` on Linux/macOS) and automatically injected into tool calls.

## Commands

### `proxy` (default)

Starts the STDIO proxy. Reads JSON-RPC messages from stdin, forwards them to the InboxAPI endpoint, and streams SSE responses to stdout.

```bash
inboxapi proxy
inboxapi proxy --endpoint https://custom-endpoint.example.com/mcp
```

Running `inboxapi` with no subcommand also starts the proxy.

### `login`

Creates an account and stores access credentials locally.

```bash
inboxapi login
inboxapi login --name myaccount
inboxapi login --endpoint https://custom-endpoint.example.com/mcp
```

### `whoami`

Displays the currently authenticated account and endpoint.

```bash
inboxapi whoami
```

## Usage with MCP Clients

InboxAPI CLI works as an MCP STDIO transport. Point your MCP client at the `inboxapi` binary:

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
claude mcp add inboxapi inboxapi
```

## Development

```bash
cargo build          # Build debug binary
cargo build --release # Build release binary
cargo test           # Run tests
cargo fmt            # Format code
```

## License

MIT
