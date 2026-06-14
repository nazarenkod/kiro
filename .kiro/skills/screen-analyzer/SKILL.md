---
name: screen-analyzer
description: Use to analyze a saved screenshot and page source from a failed test for accessibility issues and locator problems. Triggers on requests like why did this test fail to find the element, check accessibility of this screen, or analyze this Selenide failure dump.
---

# screen-analyzer

Offline analysis of a **provided** page source (and optional screenshot) for
accessibility issues and locator quality. Built for failure artifacts — Selenide
(and similar frameworks) save a screenshot plus the page source on failure, which
you can feed straight in. No live session or device is required.

## Prerequisites
- A page source XML file (and optionally a screenshot PNG) from the failed run.
- `npm install` has been run once at the repo root.

## Command
Run from the repo root.

- `node .kiro/skills/screen-analyzer/scripts/analyze.mjs --source pageSource.xml --screenshot shot.png`
- JSON output: add `--json`.
- Auto-detects platform from the XML; override with `--automation uiautomator2|xcuitest`.
- Tune touch-target threshold with `--min-touch 48`.

## What it reports
- `missing-accessible-name` — interactive control with no content-desc/label.
- `image-missing-description` — image without a text alternative.
- `small-touch-target` — tappable area below the recommended size.
- `disabled-interactive` / `hidden-interactive` — state issues that explain
  why an element could not be tapped.
- `duplicate-id` / `duplicate-accessible-name` — ambiguous locators.
- `brittle-locator` — only xpath/class-name available, no stable id.

## Use case — diagnose a Selenide failure
1. Take the screenshot + page source the framework saved on failure.
2. Run `analyze.mjs` on them.
3. Use the findings to explain why the locator failed (e.g. ambiguous id, hidden
   element) and recommend a fix; optionally hand the XML to `mobile-locator-gen`
   to propose a better locator.

## Note
Programmatic analysis runs on the **page source XML**. The screenshot is referenced
as visual context for the report; image (vision) analysis is out of scope here.
