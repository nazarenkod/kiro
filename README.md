# appium-kiro-skills

Standalone [Kiro](https://kiro.dev) skills and hooks for mobile automation, built
by lifting selected code from the [Appium MCP server](https://github.com/appium/appium-mcp)
and packaging it as plain Node ESM. **No MCP server is required** — the scripts talk
to a running Appium server directly via the `webdriver` client, and the locator /
accessibility logic is pure and runs fully offline.

## What's inside

### Skills (`.kiro/skills/`)
| Skill | Purpose |
|-------|---------|
| `appium-connect` | Attach to a **running** remote Appium session and read live page source / screenshots. |
| `appium-launch` | List running simulators/emulators, create a session and open an app. |
| `mobile-locator-gen` | Generate stable locator candidates from a page source and help complete a Page Object. |
| `screen-analyzer` | Offline analysis of a saved page source + screenshot (e.g. a Selenide failure dump) for accessibility and locator problems. |

### Hooks (`.kiro/hooks/`)
- `generate-page-objects` (manual) — capture the live screen and build a Page Object.
- `validate-locators` (on save) — re-check a Page Object's locators against the live screen.
- `analyze-screen` (manual) — analyze a saved failure artifact.

### Steering (`.kiro/steering/`)
- `mobile-test-standards` — Page Object structure, locator priority, wait strategy.

## Setup
```bash
npm install            # installs webdriver, @xmldom/xmldom, xpath
npm run test:offline   # runs the offline self-test (no device needed)
```

## Prerequisites for live use
- A running Appium server (e.g. `appium`, default `http://127.0.0.1:4723`).
- For `appium-launch` discovery: `adb` (Android) and/or `xcrun simctl` (iOS, macOS).
- Configure with `APPIUM_SERVER_URL` and `APPIUM_SESSION_ID`, or pass `--server` / `--session`.

## Example
```bash
# 1. find a device and open an app
node .kiro/skills/appium-launch/scripts/list-devices.mjs
node .kiro/skills/appium-launch/scripts/launch.mjs --platform android --udid emulator-5554 --package com.example --activity .MainActivity

# 1b. or connect to an already-running session (auto-selects if there is one;
#     lists choices if several)
node .kiro/skills/appium-connect/scripts/list-sessions.mjs

# 2. read the live screen (--session optional; add --compact for a small readable JSON)
node .kiro/skills/appium-connect/scripts/page-source.mjs --out screen.xml
node .kiro/skills/appium-connect/scripts/page-source.mjs --compact

# 3. generate locator candidates
node .kiro/skills/mobile-locator-gen/scripts/generate-locators.mjs --in screen.xml --match login

# 4. analyze a failed-test dump offline
node .kiro/skills/screen-analyzer/scripts/analyze.mjs --source screen.xml
```

## Attribution
Portions derived from [appium/appium-mcp](https://github.com/appium/appium-mcp)
(Apache-2.0). See [`NOTICE`](./NOTICE) for the list of lifted modules.
