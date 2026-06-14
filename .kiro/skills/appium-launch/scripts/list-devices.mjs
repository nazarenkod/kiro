#!/usr/bin/env node
// List running Android devices/emulators and iOS simulators.
// Usage: node list-devices.mjs [--booted] [--json]
//   --booted : only show booted iOS simulators (Android always shows attached)
//   --json   : machine-readable output
import { parseArgs, printJSON } from '../../../../lib/cli.mjs';
import { getConnectedDevices } from '../../../../lib/devicemanager/adb.mjs';
import { listSimulators, isMac } from '../../../../lib/devicemanager/ios.mjs';

const args = parseArgs();

const result = { android: [], ios: [] };
const errors = {};

try {
  result.android = await getConnectedDevices();
} catch (err) {
  errors.android = err.message;
}

try {
  result.ios = await listSimulators({ bootedOnly: !!args.booted });
} catch (err) {
  errors.ios = err.message;
}

if (Object.keys(errors).length) {
  result.errors = errors;
}

if (args.json) {
  printJSON(result);
} else {
  console.log('Android devices/emulators:');
  if (result.android.length === 0) {
    console.log('  (none)' + (errors.android ? `  [${errors.android}]` : ''));
  }
  for (const d of result.android) {
    console.log(`  ${d.udid}  state=${d.state}${d.isEmulator ? '  (emulator)' : ''}${d.model ? `  model=${d.model}` : ''}`);
  }
  console.log('');
  console.log(`iOS simulators${args.booted ? ' (booted)' : ''}:`);
  if (!isMac()) {
    console.log('  (iOS tooling only available on macOS)');
  } else if (result.ios.length === 0) {
    console.log('  (none)' + (errors.ios ? `  [${errors.ios}]` : ''));
  }
  for (const d of result.ios) {
    console.log(`  ${d.udid}  ${d.name}  [${d.runtime}]  state=${d.state}`);
  }
}
