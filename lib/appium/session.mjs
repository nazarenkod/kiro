// Lifted/adapted from appium-mcp (Apache-2.0). See NOTICE.
//   - attachToRemoteSession / getPortFromUrl   <- src/utils/url.ts
//   - validateRemoteServerUrl                  <- src/tools/session/create-session.ts
//   - attachSession (capability prefetch)      <- src/tools/session/attach-session.ts
//   - createSession (remote newSession + caps) <- src/tools/session/create-session.ts
//
// Decoupled from the MCP session-store/persistence layer: every script run
// re-attaches to the live Appium session by sessionId (the session lives on the
// Appium server, not in this process).
import WebDriver from 'webdriver';

/**
 * Resolve the port to use for a given URL.
 * Defaults to 443 for https and 80 for http when no explicit port is set.
 */
export function getPortFromUrl(url) {
  return Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
}

/**
 * Validate the provided remote server URL.
 * @throws {Error} If the URL is invalid.
 */
export function validateRemoteServerUrl(remoteServerUrl, regexRule) {
  const regexPattern = regexRule ? new RegExp(regexRule) : /^https?:\/\/.+$/;
  if (!regexPattern.test(remoteServerUrl)) {
    throw new Error(`Invalid remoteServerUrl: ${remoteServerUrl}.`);
  }
}

/**
 * Attach to an existing remote Appium session given its server URL and id.
 */
export async function attachToRemoteSession({ remoteServerUrl, sessionId, capabilities }) {
  const url = new URL(remoteServerUrl);
  const protocol = url.protocol.replace(':', '');
  const port = getPortFromUrl(url);
  const user = url.username ? decodeURIComponent(url.username) : undefined;
  const key = url.password ? decodeURIComponent(url.password) : undefined;
  return WebDriver.attachToSession({
    sessionId,
    protocol,
    hostname: url.hostname,
    port,
    path: url.pathname,
    capabilities: capabilities || {},
    ...(user && key ? { user, key } : {}),
  });
}

function readCapabilities(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const nested = value.capabilities ?? value.caps;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested;
  }
  return value;
}

/**
 * Fetch session capabilities from the Appium server via a plain HTTP request,
 * so attachToSession receives platformName (used to configure isMobile/isAndroid/isIOS).
 * Adapted from appium-mcp attach-session.ts.
 */
export async function fetchCapabilitiesFromServer(remoteServerUrl, sessionId, endpoint) {
  try {
    const url = new URL(remoteServerUrl);
    const port = getPortFromUrl(url);
    const basePath = url.pathname.replace(/\/$/, '');
    const path = `${basePath}/session/${sessionId}${endpoint ? '/' + endpoint : ''}`;
    const requestUrl = `${url.protocol}//${url.hostname}:${port}${path}`;

    const headers = { 'Content-Type': 'application/json' };
    if (url.username && url.password) {
      const credentials = Buffer.from(
        `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
      ).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
    }

    const response = await fetch(requestUrl, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return undefined;
    }
    const json = await response.json();
    return readCapabilities(json.value);
  } catch {
    return undefined;
  }
}

/**
 * Attach to an existing running remote Appium session.
 * Fetches server-side capabilities first (best effort) so the client is
 * configured with the right platform, then merges optional overrides.
 *
 * @returns {Promise<import('webdriver').Client>}
 */
export async function attachSession({ server, sessionId, capabilities = {} }) {
  validateRemoteServerUrl(server, process.env.REMOTE_SERVER_URL_ALLOW_REGEX);

  const [w3c, legacy] = await Promise.all([
    fetchCapabilitiesFromServer(server, sessionId, 'appium/session_capabilities'),
    fetchCapabilitiesFromServer(server, sessionId),
  ]);

  const merged = Object.assign({}, capabilities, legacy ?? {}, w3c ?? {});
  return attachToRemoteSession({
    remoteServerUrl: server,
    sessionId,
    capabilities: merged,
  });
}

function filterEmptyCapabilities(capabilities) {
  const filtered = { ...capabilities };
  for (const key of Object.keys(filtered)) {
    if (filtered[key] === '') {
      delete filtered[key];
    }
  }
  return filtered;
}

/**
 * Build Android capabilities (defaults merged with custom). Adapted from
 * buildAndroidCapabilities in create-session.ts (device-store coupling removed).
 */
export function buildAndroidCapabilities(customCaps = {}) {
  const defaultCaps = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Android Device',
  };
  const additionalCaps = {
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': 300,
  };
  return filterEmptyCapabilities({ ...defaultCaps, ...additionalCaps, ...customCaps });
}

/**
 * Build iOS capabilities (defaults merged with custom). Adapted from
 * buildIOSCapabilities in create-session.ts (device-store coupling removed).
 */
export function buildIOSCapabilities(customCaps = {}) {
  const defaultCaps = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': 'iPhone Simulator',
  };
  const additionalCaps = {
    'appium:newCommandTimeout': 300,
    'appium:usePrebuiltWDA': true,
    'appium:wdaStartupRetries': 4,
    'appium:wdaStartupRetryInterval': 20000,
  };
  return filterEmptyCapabilities({ ...defaultCaps, ...additionalCaps, ...customCaps });
}

/**
 * Create a NEW remote Appium session and return the WebDriver client.
 * Adapted from createSessionAction (remote branch) in create-session.ts.
 *
 * @param {object} args
 * @param {string} args.server - Appium server URL (e.g. http://localhost:4723)
 * @param {'android'|'ios'|'general'} args.platform
 * @param {object} [args.capabilities] - extra/override W3C capabilities
 * @returns {Promise<import('webdriver').Client>}
 */
export async function createSession({ server, platform, capabilities = {} }) {
  validateRemoteServerUrl(server, process.env.REMOTE_SERVER_URL_ALLOW_REGEX);

  let finalCapabilities;
  if (platform === 'android') {
    finalCapabilities = buildAndroidCapabilities(capabilities);
  } else if (platform === 'ios') {
    finalCapabilities = buildIOSCapabilities(capabilities);
  } else {
    finalCapabilities = { ...capabilities };
  }

  const url = new URL(server);
  const protocol = url.protocol.replace(':', '');
  const port = getPortFromUrl(url);
  const user = url.username ? decodeURIComponent(url.username) : undefined;
  const key = url.password ? decodeURIComponent(url.password) : undefined;

  const client = await WebDriver.newSession({
    protocol,
    hostname: url.hostname,
    port,
    path: url.pathname,
    ...(user && key ? { user, key } : {}),
    capabilities: finalCapabilities,
  });
  return client;
}

/**
 * List the active sessions on a remote Appium server (GET /sessions).
 *
 * @param {string} server - Appium server URL.
 * @returns {Promise<Array<{id:string,platformName?:string,deviceName?:string,automationName?:string,app?:string,capabilities:object}>>}
 */
export async function listRemoteSessions(server) {
  const url = new URL(server);
  const port = getPortFromUrl(url);
  const basePath = url.pathname.replace(/\/$/, '');
  const requestUrl = `${url.protocol}//${url.hostname}:${port}${basePath}/sessions`;

  const headers = { 'Content-Type': 'application/json' };
  if (url.username && url.password) {
    const credentials = Buffer.from(
      `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`
    ).toString('base64');
    headers.Authorization = `Basic ${credentials}`;
  }

  const res = await fetch(requestUrl, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`GET /sessions returned ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const list = Array.isArray(json.value) ? json.value : [];
  return list.map((s) => {
    const caps = s.capabilities || {};
    return {
      id: s.id || s.sessionId,
      platformName: caps.platformName,
      deviceName: caps['appium:deviceName'] || caps.deviceName,
      automationName: caps['appium:automationName'] || caps.automationName,
      app: caps['appium:appPackage'] || caps['appium:bundleId'] || caps['appium:app'],
      capabilities: caps,
    };
  });
}

/**
 * Resolve which session to use for a CLI command:
 *   - explicit --session / APPIUM_SESSION_ID wins,
 *   - otherwise auto-select when the server has exactly one session,
 *   - print the list and exit when there are zero or several.
 *
 * @returns {Promise<string>} the chosen sessionId
 */
export async function pickSession(args = {}, server) {
  const requested = args.session || process.env.APPIUM_SESSION_ID;
  if (requested) {
    return requested;
  }
  let sessions;
  try {
    sessions = await listRemoteSessions(server);
  } catch (err) {
    console.error(`Error: could not list sessions on ${server}. ${err.message}`);
    process.exit(1);
  }
  if (sessions.length === 0) {
    console.error(
      `Error: no active Appium sessions on ${server}. Start one with the appium-launch skill (or your test), then retry.`
    );
    process.exit(1);
  }
  if (sessions.length === 1) {
    console.error(`Auto-selected the only active session: ${sessions[0].id}`);
    return sessions[0].id;
  }
  console.error(`Multiple active sessions on ${server} — choose one and pass --session <id>:`);
  for (const s of sessions) {
    console.error(
      `  ${s.id}  ${s.platformName || '?'} ${s.deviceName || ''}${s.app ? '  (' + s.app + ')' : ''}`
    );
  }
  process.exit(2);
}

/**
 * Best-effort detection of the automation name from a page-source XML.
 * iOS XCUITest sources use XCUIElementType* tags; Android UiAutomator2 sources
 * use a <hierarchy> root with android.* class tags.
 */
export function detectAutomationName(sourceXML) {
  if (/XCUIElementType/.test(sourceXML)) {
    return 'xcuitest';
  }
  return 'uiautomator2';
}
