// Inspired by appium-mcp src/devicemanager/ios-manager.ts, but re-implemented
// over the raw `xcrun simctl` CLI to avoid the heavy node-simctl / appium-ios-device
// dependencies. See NOTICE. iOS tooling is only available on macOS.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export function isMac() {
  return process.platform === 'darwin';
}

/**
 * List iOS simulators via `xcrun simctl list devices --json`.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.bootedOnly] - only return simulators in the Booted state.
 * @returns {Promise<Array<{name:string,udid:string,state:string,type:'simulator',runtime:string}>>}
 */
export async function listSimulators({ bootedOnly = false } = {}) {
  if (!isMac()) {
    return [];
  }
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      'xcrun',
      ['simctl', 'list', 'devices', '--json'],
      { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }
    ));
  } catch (err) {
    throw new Error(
      `Failed to run 'xcrun simctl list'. Are Xcode command line tools installed? ${err.message}`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Failed to parse simctl output: ${err.message}`);
  }

  const simulators = [];
  for (const [runtime, deviceList] of Object.entries(parsed.devices || {})) {
    if (!Array.isArray(deviceList)) {
      continue;
    }
    for (const device of deviceList) {
      if (device.isAvailable === false) {
        continue;
      }
      if (bootedOnly && device.state !== 'Booted') {
        continue;
      }
      simulators.push({
        name: device.name,
        udid: device.udid,
        state: device.state,
        type: 'simulator',
        // e.g. "com.apple.CoreSimulator.SimRuntime.iOS-18-2"
        runtime: runtime.split('.').pop(),
      });
    }
  }
  return simulators;
}

/** List only booted (running) simulators. */
export async function listBootedSimulators() {
  return listSimulators({ bootedOnly: true });
}
