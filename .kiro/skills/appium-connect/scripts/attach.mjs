#!/usr/bin/env node
// Attach to a running remote Appium session and verify it is alive.
// Usage: node attach.mjs --server http://127.0.0.1:4723 --session <sessionId>
//        (or set APPIUM_SERVER_URL / APPIUM_SESSION_ID)
import { parseArgs, resolveServer, printJSON, fail } from '../../../../lib/cli.mjs';
import { attachSession, pickSession } from '../../../../lib/appium/session.mjs';
import { getCurrentContext, getPageSource } from '../../../../lib/appium/command.mjs';

const args = parseArgs();
const server = resolveServer(args);
const session = await pickSession(args, server);

try {
  const driver = await attachSession({ server, sessionId: session });
  let context = null;
  try {
    context = await getCurrentContext(driver);
  } catch {
    // some drivers/contexts may not support this; not fatal
  }
  const source = await getPageSource(driver);
  printJSON({
    ok: true,
    server,
    sessionId: session,
    context,
    pageSourceLength: source.length,
  });
} catch (err) {
  fail(`Failed to attach to session ${session} on ${server}. ${err.message}`);
}
