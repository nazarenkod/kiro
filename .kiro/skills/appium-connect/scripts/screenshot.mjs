#!/usr/bin/env node
// Capture a screenshot from a running remote Appium session and save it as PNG.
// Usage: node screenshot.mjs --server <url> --session <id> [--out screenshot.png]
import { writeFile } from 'node:fs/promises';
import { parseArgs, resolveServer, resolveSession, fail } from '../../../../lib/cli.mjs';
import { attachSession } from '../../../../lib/appium/session.mjs';
import { getScreenshot } from '../../../../lib/appium/command.mjs';

const args = parseArgs();
const server = resolveServer(args);
const session = resolveSession(args);
const out = args.out || 'screenshot.png';
if (!session) {
  fail('No session id. Pass --session <id> or set APPIUM_SESSION_ID.');
}

try {
  const driver = await attachSession({ server, sessionId: session });
  const base64 = await getScreenshot(driver, args.element);
  await writeFile(out, Buffer.from(base64, 'base64'));
  console.error(`Wrote screenshot to ${out}`);
} catch (err) {
  fail(`Failed to capture screenshot. ${err.message}`);
}
