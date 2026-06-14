#!/usr/bin/env node
// Fetch the page source (XML) from a running remote Appium session.
// Usage: node page-source.mjs --server <url> --session <id> [--out source.xml]
//        prints to stdout when --out is omitted.
import { writeFile } from 'node:fs/promises';
import { parseArgs, resolveServer, resolveSession, fail } from '../../../../lib/cli.mjs';
import { attachSession } from '../../../../lib/appium/session.mjs';
import { getPageSource } from '../../../../lib/appium/command.mjs';

const args = parseArgs();
const server = resolveServer(args);
const session = resolveSession(args);
if (!session) {
  fail('No session id. Pass --session <id> or set APPIUM_SESSION_ID.');
}

try {
  const driver = await attachSession({ server, sessionId: session });
  const source = await getPageSource(driver);
  if (args.out) {
    await writeFile(args.out, source, 'utf-8');
    console.error(`Wrote page source (${source.length} bytes) to ${args.out}`);
  } else {
    process.stdout.write(source);
  }
} catch (err) {
  fail(`Failed to fetch page source. ${err.message}`);
}
