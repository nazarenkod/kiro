#!/usr/bin/env node
// Create a new Appium session against a remote server and open an app.
// Usage:
//   node launch.mjs --platform android --udid emulator-5554 \
//        --app /path/app.apk            (install + launch), OR
//        --package com.example --activity .MainActivity   (launch installed app)
//   node launch.mjs --platform ios --udid <simUdid> \
//        --bundle com.example.app       (launch installed app), OR --app /path/app.app
// Common:
//   --server http://127.0.0.1:4723   (or APPIUM_SERVER_URL)
//   --device-name "iPhone 15"
//   --platform-version "17.4"
//   --caps '{"appium:noReset":true}'  (extra/override W3C caps, JSON)
//   --activate                        (also call activateApp after session start)
import { parseArgs, resolveServer, printJSON, fail } from '../../../../lib/cli.mjs';
import { createSession } from '../../../../lib/appium/session.mjs';
import { activateApp } from '../../../../lib/appium/command.mjs';

const args = parseArgs();
const server = resolveServer(args);
const platform = (args.platform || '').toLowerCase();
if (platform !== 'android' && platform !== 'ios' && platform !== 'general') {
  fail('Pass --platform android|ios (or general for a custom remote driver).');
}

// Build per-platform capability overrides from convenient flags.
const caps = {};
if (args.udid) caps['appium:udid'] = args.udid;
if (args['device-name']) caps['appium:deviceName'] = args['device-name'];
if (args['platform-version']) caps['appium:platformVersion'] = args['platform-version'];
if (args.app) caps['appium:app'] = args.app;
if (platform === 'android') {
  if (args.package) caps['appium:appPackage'] = args.package;
  if (args.activity) caps['appium:appActivity'] = args.activity;
} else if (platform === 'ios') {
  if (args.bundle) caps['appium:bundleId'] = args.bundle;
}
if (args.caps) {
  try {
    Object.assign(caps, JSON.parse(args.caps));
  } catch (err) {
    fail(`--caps must be valid JSON. ${err.message}`);
  }
}

try {
  const driver = await createSession({ server, platform, capabilities: caps });
  const sessionId = driver.sessionId;

  // Optionally bring an already-installed app to the foreground.
  if (args.activate) {
    const appId = args.bundle || args.package;
    if (appId) {
      await activateApp(driver, appId);
    }
  }

  printJSON({
    ok: true,
    server,
    sessionId,
    platform,
    capabilities: caps,
    hint: `Reuse this session with appium-connect: --session ${sessionId}`,
  });
} catch (err) {
  fail(`Failed to create session / open app. ${err.message}`);
}
