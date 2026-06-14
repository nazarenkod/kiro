// Tiny shared CLI helpers for the skill scripts (no external deps).

/**
 * Parse `--key value` and `--flag` style args into an object.
 * Repeated keys collapse to the last value. `--flag` (no value) becomes true.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/** Read all of stdin as a string (returns '' if nothing piped). */
export async function readStdin() {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/** Resolve the Appium server URL from --server or APPIUM_SERVER_URL. */
export function resolveServer(args) {
  return args.server || process.env.APPIUM_SERVER_URL || 'http://127.0.0.1:4723';
}

/** Resolve the session id from --session or APPIUM_SESSION_ID. */
export function resolveSession(args) {
  return args.session || process.env.APPIUM_SESSION_ID || '';
}

/** Print JSON to stdout. */
export function printJSON(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

/** Fail with a message on stderr and a non-zero exit code. */
export function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
