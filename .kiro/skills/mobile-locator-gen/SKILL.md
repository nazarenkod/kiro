---
name: mobile-locator-gen
description: Use to add or complete a locator in a Page Object class, or to generate a Page Object from an Appium page source. Triggers on requests like add a locator for the Login button, complete this Page Object, or generate locators for the current screen.
---

# mobile-locator-gen

Generate stable locator candidates from an Appium page source and help write them
into a Page Object. The script `generate-locators.mjs` is the **engine** (it emits
structured candidates); YOU (the agent) match the element the user described and
insert the locator into their class.

## Prerequisites
- A page source XML — either live (use `appium-connect` `page-source.mjs`) or a
  saved file / failure artifact.
- `npm install` has been run once at the repo root (installs `@xmldom/xmldom`, `xpath`).

## Engine command
Run from the repo root.

- From a file: `node .kiro/skills/mobile-locator-gen/scripts/generate-locators.mjs --in source.xml`
- From a live session (piped):
  `node .kiro/skills/appium-connect/scripts/page-source.mjs --session <id> | node .kiro/skills/mobile-locator-gen/scripts/generate-locators.mjs`
- Narrow to one element: add `--match "login"` (matches text/content-desc/resource-id/name/label).
- Only interactive elements: add `--interactive`.

Output is JSON: `{ automationName, total, returned, candidates[] }`. Each candidate has
`tagName, text, contentDesc, resourceId, name, label, path, clickable, best, locators`.
`best` is the highest-priority locator; `locators` is the full ordered map.

## Use case — complete a Page Object (primary)
When the user pastes a Page Object class (or path) and asks to add/complete a locator:
1. Obtain the page source (live via `appium-connect`, or a provided XML / Selenide
   artifact). If none is available, ask for it.
2. Run the engine with `--match <keyword>` from the user's description.
3. Pick the candidate that matches the described element (by text / content-desc /
   resource-id / type).
4. Choose the locator following `mobile-test-standards` priority
   (accessibility id > id > predicate/uiautomator > xpath last) — usually `best`.
5. Insert the field into the Page Object **in the class's own style and language**
   (Selenide `$(...)`, `@AndroidFindBy`, `By...`, WebElement, etc.) without breaking
   surrounding code. Show the diff.

## Use case — full Page Object
Run the engine without `--match`, then assemble a class for the screen following
`mobile-test-standards`.

## Inspect the raw structure (page source as JSON)
To turn a page source XML into a readable JSON tree (`tagName`/`attributes`/`path`/`children`):

- `node .kiro/skills/mobile-locator-gen/scripts/source-to-json.mjs --in source.xml`
- Limit nesting for an overview: add `--depth 4` (deeper children are replaced by a count).
- Works offline or piped from a live session:
  `node .kiro/skills/appium-connect/scripts/page-source.mjs --session <id> | node .kiro/skills/mobile-locator-gen/scripts/source-to-json.mjs`

`path` is the dot-separated index path used throughout the locator pipeline.
