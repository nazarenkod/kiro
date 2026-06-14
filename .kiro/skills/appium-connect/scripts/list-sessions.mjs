#!/usr/bin/env node
// List the active sessions on a running remote Appium server (GET /sessions).
// Usage: node list-sessions.mjs [--server <url>] [--json]
import { parseArgs, resolveServer, printJSON, fail } from '../../../../lib/cli.mjs';
import { listRemoteSessions } from '../../../../lib/appium/session.mjs';

const args = parseArgs();
const server = resolveServer(args);

let sessions;
try {
  sessions = await listRemoteSessions(server);
} catch (err) {
  fail(`Could not list sessions on ${server}. Is the Appium server running? ${err.message}`);
}

if (args.json) {
  printJSON({ server, count: sessions.length, sessions });
} else {
  console.log(`Active sessions on ${server}: ${sessions.length}`);
  for (const s of sessions) {
    console.log(`  ${s.id}  ${s.platformName || '?'} ${s.deviceName || ''}${s.app ? '  (' + s.app + ')' : ''}  [${s.automationName || '?'}]`);
  }
  if (sessions.length === 0) {
    console.log('  (none — start one with the appium-launch skill or your test)');
  } else if (sessions.length === 1) {
    console.log(`\nTip: the connect scripts auto-use this session when --session is omitted.`);
  }
}
