// Adapted from appium-mcp: src/command.ts (Apache-2.0). See NOTICE.
//
// Remote-only subset: the driver is always a `webdriver` Client attached to a
// running Appium session, so the embedded-driver branches from the original are
// dropped and we call the Client methods directly.

/** Retrieve the current page/source (XML for native screens). */
export async function getPageSource(driver) {
  return await driver.getPageSource();
}

/** Capture a screenshot. Returns a base64-encoded PNG string. */
export async function getScreenshot(driver, elementId) {
  if (elementId) {
    return await driver.takeElementScreenshot(elementId);
  }
  return await driver.takeScreenshot();
}

/** Find a single element by strategy + selector. Returns the element handle. */
export async function findElement(driver, strategy, selector) {
  return await driver.findElement(strategy, selector);
}

/** Activate (bring to foreground / launch) an app by bundle/package id. */
export async function activateApp(driver, appId) {
  return await driver.activateApp(appId);
}

/** Get the current Appium context (e.g. NATIVE_APP or a WEBVIEW_*). */
export async function getCurrentContext(driver) {
  return String(await driver.getAppiumContext());
}

/** Get the current window size in pixels. */
export async function getWindowSize(driver) {
  const { width, height } = await driver.getWindowRect();
  return { width, height };
}
