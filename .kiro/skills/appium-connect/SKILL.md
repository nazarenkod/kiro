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
- At least one active session on that server (start one with the `appium-launch`
  skill, or it already exists from your test framework / a connected device).
- `npm install` has been run once at the repo root (installs `webdriver`).

## Configuration
- Server URL: `--server <url>` or env `APPIUM_SERVER_URL` (default `http://127.0.0.1:4723`).
- Session id: `--session <id>` or env `APPIUM_SESSION_ID`. **Optional** — if omitted,
  the scripts query the server's active sessions and auto-select when there is
  exactly one. If several exist, they print the list and ask you to pass `--session`.

## Commands
Run from the repo root.

- List active sessions on the server:
  `node .kiro/skills/appium-connect/scripts/list-sessions.mjs` (add `--json`)
- Verify connectivity (auto-selects the session if there is only one):
  `node .kiro/skills/appium-connect/scripts/attach.mjs`
- Get page source (to stdout or a file):
  `node .kiro/skills/appium-connect/scripts/page-source.mjs --out source.xml`
  - `--json` — full readable JSON tree (`tagName`/`attributes`/`path`/`children`)
  - `--compact` — smaller, readable JSON (only meaningful elements + key attributes)
- Screenshot to PNG:
  `node .kiro/skills/appium-connect/scripts/screenshot.mjs --out shot.png`

## Choosing among multiple sessions
When more than one session is connected (e.g. two devices), run `list-sessions.mjs`,
show the user the options (id / platform / device / app), and re-run with the chosen
`--session <id>`.

## Typical flow
1. `list-sessions.mjs` (or just run a command and let it auto-select one session).
2. Pipe `page-source.mjs` into the `mobile-locator-gen` skill to build/complete a
   Page Object, or into `screen-analyzer` for accessibility checks.

## Notes / troubleshooting
- "Failed to attach": check the server URL and that the `sessionId` still exists
  (sessions expire on `newCommandTimeout`).
- The capabilities are fetched from the server before attaching so the client is
  configured for the right platform.
