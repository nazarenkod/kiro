---
name: appium-connect
description: Use when connecting to a running remote Appium server and attaching to an existing session to read the live page source or capture a screenshot. Triggers on requests like attach to my Appium session, get the current page source, or take a screenshot of the device.
---

# appium-connect

Attach to an **already running** Appium session on a remote server (no MCP server
involved) and read live state from the device. Each script re-attaches by
`sessionId` — the session lives on the Appium server, not in this process.

## Prerequisites
- An Appium server is running (e.g. `appium` on `http://127.0.0.1:4723`).
- An active session exists. Its `sessionId` is known (start one with the
  `appium-launch` skill, or take it from your test framework / `GET /sessions`).
- `npm install` has been run once at the repo root (installs `webdriver`).

## Configuration
- Server URL: `--server <url>` or env `APPIUM_SERVER_URL` (default `http://127.0.0.1:4723`).
- Session id: `--session <id>` or env `APPIUM_SESSION_ID`.

## Commands
Run from the repo root.

- Verify connectivity:
  `node .kiro/skills/appium-connect/scripts/attach.mjs --server <url> --session <id>`
- Get page source (to stdout or a file):
  `node .kiro/skills/appium-connect/scripts/page-source.mjs --session <id> --out source.xml`
  Add `--json` to get a readable JSON tree (`tagName`/`attributes`/`path`/`children`) instead of XML.
- Screenshot to PNG:
  `node .kiro/skills/appium-connect/scripts/screenshot.mjs --session <id> --out shot.png`

## Typical flow
1. Confirm the session is alive with `attach.mjs`.
2. Pipe `page-source.mjs` into the `mobile-locator-gen` skill to build/complete a
   Page Object, or into `screen-analyzer` for accessibility checks.

## Notes / troubleshooting
- "Failed to attach": check the server URL and that the `sessionId` still exists
  (sessions expire on `newCommandTimeout`).
- The capabilities are fetched from the server before attaching so the client is
  configured for the right platform.
