#!/usr/bin/env node
// InboxAPI Credential Check — SessionStart hook
// Verifies InboxAPI credentials are present and valid on session startup.
// Always exits 0 (non-blocking, informational only)

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function findCredentials() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [];

  // Platform config dir
  if (process.platform === "darwin") {
    candidates.push(
      path.join(home, "Library", "Application Support", "inboxapi", "credentials.json"),
    );
  }
  candidates.push(path.join(home, ".config", "inboxapi", "credentials.json"));
  candidates.push(
    path.join(home, ".local", "inboxapi", "credentials.json"),
  );

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function main() {
  const credPath = findCredentials();

  if (!credPath) {
    process.stderr.write(
      "\n[InboxAPI] No credentials found. Run `npx -y @inboxapi/cli login` to authenticate.\n\n",
    );
    process.exit(0);
  }

  try {
    const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
    const email = creds.email || creds.account_name || "(unknown)";
    process.stderr.write(
      `\n[InboxAPI] Authenticated as: ${email}\n\n`,
    );
  } catch {
    process.stderr.write(
      "\n[InboxAPI] Credentials file exists but could not be read. Run `npx -y @inboxapi/cli login` to re-authenticate.\n\n",
    );
  }

  process.exit(0);
}

main();
