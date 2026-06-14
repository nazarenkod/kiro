#!/usr/bin/env node
// Fetch the page source from a running remote Appium session.
// Usage: node page-source.mjs --server <url> --session <id> [--out source.xml] [--json|--compact]
//        prints to stdout when --out is omitted.
//   --json    : convert the XML into a readable JSON tree (tagName/attributes/path/children)
//   --compact : smaller, readable JSON (only meaningful elements + key attributes)
import { writeFile } from 'node:fs/promises';
import { parseArgs, resolveServer, fail } from '../../../../lib/cli.mjs';
import { attachSession, pickSession } from '../../../../lib/appium/session.mjs';
import { getPageSource } from '../../../../lib/appium/command.mjs';
import { xmlToJSON } from '../../../../lib/locators/source-parsing.mjs';
import { compactTree } from '../../../../lib/locators/compact-source.mjs';

const args = parseArgs();
const server = resolveServer(args);
const session = await pickSession(args, server);

try {
  const driver = await attachSession({ server, sessionId: session });
  const source = await getPageSource(driver);
  let output = source;
  if (args.compact) {
    output = JSON.stringify(compactTree(xmlToJSON(source)), null, 2);
  } else if (args.json) {
    output = JSON.stringify(xmlToJSON(source), null, 2);
  }
  if (args.out) {
    await writeFile(args.out, output, 'utf-8');
    const kind = args.compact ? 'compact JSON' : args.json ? 'JSON tree' : 'page source';
    console.error(`Wrote ${kind} (${output.length} bytes) to ${args.out}`);
  } else {
    process.stdout.write(output);
  }
} catch (err) {
  fail(`Failed to fetch page source. ${err.message}`);
}
