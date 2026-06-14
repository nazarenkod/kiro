// Minimal logger replacing appium-mcp's src/logger.js for the lifted modules.
// Writes to stderr so script stdout stays clean (JSON/XML payloads).
const enabled = process.env.APPIUM_KIRO_DEBUG === '1';

const log = {
  debug: (...args) => {
    if (enabled) console.error('[debug]', ...args);
  },
  info: (...args) => {
    if (enabled) console.error('[info]', ...args);
  },
  warn: (...args) => console.error('[warn]', ...args),
  error: (...args) => console.error('[error]', ...args),
};

export default log;
