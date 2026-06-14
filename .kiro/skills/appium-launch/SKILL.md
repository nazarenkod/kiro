---
name: appium-launch
description: Use to list running simulators or emulators, start a new Appium session and open an app. Triggers on requests like show running simulators, launch the app on the emulator, or start an Appium session and open my app.
---

# appium-launch

Discover running devices, create a **new** Appium session against a remote server,
and open an app. Prints the new `sessionId` so the `appium-connect` skill can reuse it.

## Prerequisites
- An Appium server is running (e.g. `appium` on `http://127.0.0.1:4723`).
- Platform tooling on PATH for discovery: `adb` (Android) and/or `xcrun simctl`
  (iOS, macOS only).
- `npm install` has been run once at the repo root.

## Commands
Run from the repo root.

- List devices:
  `node .kiro/skills/appium-launch/scripts/list-devices.mjs` (add `--booted` for
  booted iOS sims only, `--json` for machine output).
- Launch (Android, installed app):
  `node .kiro/skills/appium-launch/scripts/launch.mjs --platform android --udid emulator-5554 --package com.example --activity .MainActivity`
- Launch (Android, install apk):
  `... launch.mjs --platform android --udid emulator-5554 --app /path/app.apk`
- Launch (iOS simulator, installed app):
  `... launch.mjs --platform ios --udid <simUdid> --bundle com.example.app`

## Useful flags
- `--server <url>` (or `APPIUM_SERVER_URL`)
- `--device-name`, `--platform-version`
- `--caps '{"appium:noReset":true}'` to add/override any W3C capability
- `--activate` to also bring an installed app (`--bundle`/`--package`) to the foreground

## Typical flow
1. `list-devices.mjs` to find the target `udid`.
2. `launch.mjs ...` to open the app — note the printed `sessionId`.
3. Hand the `sessionId` to `appium-connect` for page source / screenshots.
