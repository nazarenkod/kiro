#!/usr/bin/env node
// Generate candidate locators for elements from an Appium page-source XML.
// This is the ENGINE: it emits structured candidates; the agent matches the
// element the user described and writes the locator into the Page Object.
//
// Usage:
//   node generate-locators.mjs --in source.xml [--automation uiautomator2|xcuitest]
//   cat source.xml | node generate-locators.mjs
// Options:
//   --match <text>   filter candidates by text/content-desc/resource-id/name/label (substring, case-insensitive)
//   --interactive    only clickable/interactive elements
//   --limit <n>      cap number of candidates (default 200)
import { readFile } from 'node:fs/promises';
import { parseArgs, readStdin, printJSON, fail } from '../../../../lib/cli.mjs';
import { generateAllElementLocators } from '../../../../lib/locators/generate-all-locators.mjs';
import { detectAutomationName } from '../../../../lib/appium/session.mjs';

const args = parseArgs();

let xml = '';
try {
  xml = args.in ? await readFile(args.in, 'utf-8') : await readStdin();
} catch (err) {
  fail(`Could not read page source. ${err.message}`);
}
if (!xml.trim()) {
  fail('Empty page source. Pass --in <file.xml> or pipe XML via stdin.');
}

const automationName = args.automation || detectAutomationName(xml);
const filters = args.interactive ? { fetchableOnly: true } : {};

let elements;
try {
  elements = generateAllElementLocators(xml, true, automationName, filters);
} catch (err) {
  fail(`Failed to generate locators. ${err.message}`);
}

const match = args.match ? String(args.match).toLowerCase() : null;
const limit = args.limit ? parseInt(args.limit, 10) : 200;

const candidates = elements
  .map((el) => {
    const a = el.attributes || {};
    const localeKeys = el.locators || {};
    const best = Object.entries(localeKeys)[0] || null;
    return {
      tagName: el.tagName,
      path: el.path,
      text: el.text || '',
      contentDesc: el.contentDesc || '',
      resourceId: el.resourceId || '',
      name: a.name || '',
      label: a.label || '',
      clickable: el.clickable,
      enabled: el.enabled,
      displayed: el.displayed,
      best: best ? { strategy: best[0], selector: best[1] } : null,
      locators: el.locators,
    };
  })
  .filter((c) => {
    if (!match) return true;
    return [c.text, c.contentDesc, c.resourceId, c.name, c.label]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(match));
  })
  .slice(0, limit);

printJSON({
  automationName,
  total: elements.length,
  returned: candidates.length,
  candidates,
});
