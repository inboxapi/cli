#!/usr/bin/env node
// InboxAPI Activity Logger — PostToolUse hook
// Logs all InboxAPI MCP tool usage to .claude/inboxapi-activity.log
// Always exits 0 (non-blocking)

const fs = require("fs");
const path = require("path");

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
  const cwd = data.cwd || process.cwd();

  // Only log inboxapi tools
  if (!toolName.includes("inboxapi")) {
    process.exit(0);
  }

  const timestamp = new Date().toISOString();
  const shortName = toolName.replace("mcp__inboxapi__", "");

  // Build a concise log entry based on the tool type
  let details = "";
  switch (shortName) {
    case "send_email":
      details = `to=${toolInput.to || "?"}, subject="${toolInput.subject || "?"}"`;
      break;
    case "send_reply":
      details = `email_id=${toolInput.email_id || "?"}, body_length=${(toolInput.body || "").length}`;
      break;
    case "forward_email":
      details = `email_id=${toolInput.email_id || "?"}, to=${toolInput.to || "?"}`;
      break;
    case "get_email":
      details = `email_id=${toolInput.email_id || "?"}`;
      break;
    case "get_emails":
      details = `limit=${toolInput.limit || "default"}`;
      break;
    case "search_emails":
      details = `query="${toolInput.query || "?"}"`;
      break;
    case "get_thread":
      details = `thread_id=${toolInput.thread_id || "?"}`;
      break;
    default: {
      const keys = toolInput && typeof toolInput === "object" ? Object.keys(toolInput) : [];
      details = keys.length ? `fields=${keys.join(",")}` : "fields=<none>";
      break;
    }
  }

  const logLine = `[${timestamp}] ${shortName}: ${details}\n`;

  // Write to log file
  const logPath = path.join(cwd, ".claude", "inboxapi-activity.log");
  try {
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logPath, logLine);
  } catch {
    // Non-critical — don't fail the tool call
  }

  process.exit(0);
}

main();
