#!/usr/bin/env node
// Fetch the page source from a running remote Appium session.
// Usage: node page-source.mjs --server <url> --session <id> [--out source.xml] [--json]
//        prints to stdout when --out is omitted.
//   --json : convert the XML into a readable JSON tree (tagName/attributes/path/children)
import { writeFile } from 'node:fs/promises';
import { parseArgs, resolveServer, resolveSession, fail } from '../../../../lib/cli.mjs';
import { attachSession } from '../../../../lib/appium/session.mjs';
import { getPageSource } from '../../../../lib/appium/command.mjs';
import { xmlToJSON } from '../../../../lib/locators/source-parsing.mjs';

const args = parseArgs();
const server = resolveServer(args);
const session = resolveSession(args);
if (!session) {
  fail('No session id. Pass --session <id> or set APPIUM_SESSION_ID.');
}

try {
  const driver = await attachSession({ server, sessionId: session });
  const source = await getPageSource(driver);
  const output = args.json ? JSON.stringify(xmlToJSON(source), null, 2) : source;
  if (args.out) {
    await writeFile(args.out, output, 'utf-8');
    console.error(`Wrote ${args.json ? 'JSON tree' : 'page source'} (${output.length} bytes) to ${args.out}`);
  } else {
    process.stdout.write(output);
  }
} catch (err) {
  fail(`Failed to fetch page source. ${err.message}`);
}
