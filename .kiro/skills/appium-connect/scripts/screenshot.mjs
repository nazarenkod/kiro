#!/usr/bin/env node
// Capture a screenshot from a running remote Appium session and save it as PNG.
// Usage: node screenshot.mjs --server <url> --session <id> [--out screenshot.png]
import { writeFile } from 'node:fs/promises';
import { parseArgs, resolveServer, fail } from '../../../../lib/cli.mjs';
import { attachSession, pickSession } from '../../../../lib/appium/session.mjs';
import { getScreenshot } from '../../../../lib/appium/command.mjs';

const args = parseArgs();
const server = resolveServer(args);
const session = await pickSession(args, server);
const out = args.out || 'screenshot.png';

try {
  const driver = await attachSession({ server, sessionId: session });
  const base64 = await getScreenshot(driver, args.element);
  await writeFile(out, Buffer.from(base64, 'base64'));
  console.error(`Wrote screenshot to ${out}`);
} catch (err) {
  fail(`Failed to capture screenshot. ${err.message}`);
}
