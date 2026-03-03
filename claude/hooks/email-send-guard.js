#!/usr/bin/env node
// InboxAPI Email Send Guard — PreToolUse hook
// Reviews outbound emails before sending. Logs details to stderr for user visibility.
// Exit 0 = allow

const fs = require("fs");

function main() {
  const input = fs.readFileSync(0, "utf8");
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const toolName = data.tool_name || "";
  const toolInput = data.tool_input || {};

  // Only inspect send-related tools
  if (
    !toolName.includes("send_email") &&
    !toolName.includes("send_reply") &&
    !toolName.includes("forward_email")
  ) {
    process.exit(0);
  }

  const to = toolInput.to || toolInput.recipient || "(unknown)";
  const subject = toolInput.subject || "(no subject)";
  const body = toolInput.body || toolInput.message || "";
  const action = toolName.includes("forward")
    ? "FORWARD"
    : toolName.includes("reply")
      ? "REPLY"
      : "SEND";

  // Log details to stderr so the user sees them in the Claude Code UI
  process.stderr.write(`\n[InboxAPI Send Guard] ${action}\n`);
  process.stderr.write(`  To:      ${to}\n`);
  process.stderr.write(`  Subject: ${subject}\n`);
  if (body.length > 0) {
    const preview = body.length > 200 ? body.substring(0, 200) + "..." : body;
    process.stderr.write(`  Body:    ${preview}\n`);
  }
  process.stderr.write("\n");

  // Check for self-send (common AI agent mistake)
  if (to.includes("@inboxapi.ai") || to.includes("@inboxapi.com")) {
    // This might be intentional, but warn
    process.stderr.write(
      `  [WARNING] Recipient is an @inboxapi address. Did you mean to send to an external address?\n\n`,
    );
  }

  // Check for empty body
  if (body.trim().length === 0) {
    process.stderr.write(`  [WARNING] Email body is empty.\n\n`);
  }

  // Allow by default — the user sees the preview and can deny via Claude Code's permission prompt
  process.exit(0);
}

main();
