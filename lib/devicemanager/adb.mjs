// Inspired by appium-mcp src/devicemanager/adb-manager.ts, but re-implemented
// over the raw `adb` CLI to avoid the heavy appium-adb dependency. See NOTICE.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ADB = process.env.ADB_PATH || 'adb';

/**
 * List connected Android devices and running emulators via `adb devices -l`.
 *
 * @returns {Promise<Array<{udid:string,state:string,type:'android',isEmulator:boolean,model?:string}>>}
 */
export async function getConnectedDevices() {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(ADB, ['devices', '-l'], {
      timeout: 15000,
    }));
  } catch (err) {
    throw new Error(
      `Failed to run '${ADB} devices'. Is Android platform-tools installed and on PATH? ${err.message}`
    );
  }

  const devices = [];
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('List of devices')) {
      continue;
    }
    // Format: "<serial> <state> [key:value ...]"
    const parts = line.split(/\s+/);
    const udid = parts[0];
    const state = parts[1];
    if (!udid || !state) {
      continue;
    }
    const modelPart = parts.find((p) => p.startsWith('model:'));
    devices.push({
      udid,
      state, // device | offline | unauthorized
      type: 'android',
      isEmulator: udid.startsWith('emulator-'),
      ...(modelPart ? { model: modelPart.slice('model:'.length) } : {}),
    });
  }
  return devices;
}
