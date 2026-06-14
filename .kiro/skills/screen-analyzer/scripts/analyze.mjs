#!/usr/bin/env node
// Offline analysis of a saved page-source (and optional screenshot) for
// accessibility issues and locator quality. Designed for failure artifacts
// (e.g. Selenide dumps a screenshot + page source on failure).
//
// Usage:
//   node analyze.mjs --source pageSource.xml [--screenshot shot.png]
//   cat pageSource.xml | node analyze.mjs
// Options:
//   --automation uiautomator2|xcuitest   (auto-detected from XML if omitted)
//   --min-touch <px>   minimum recommended touch target (default 40)
//   --json             machine-readable output
import { readFile } from 'node:fs/promises';
import { parseArgs, readStdin, printJSON, fail } from '../../../../lib/cli.mjs';
import { analyzeAccessibility } from '../../../../lib/analysis/accessibility.mjs';
import { detectAutomationName } from '../../../../lib/appium/session.mjs';

const args = parseArgs();

let xml = '';
try {
  const src = args.source || args.in;
  xml = src ? await readFile(src, 'utf-8') : await readStdin();
} catch (err) {
  fail(`Could not read page source. ${err.message}`);
}
if (!xml.trim()) {
  fail('Empty page source. Pass --source <file.xml> or pipe XML via stdin.');
}

const automationName = args.automation || detectAutomationName(xml);
const minTouchTargetPx = args['min-touch'] ? parseInt(args['min-touch'], 10) : 40;

let report;
try {
  report = analyzeAccessibility(xml, { automationName, minTouchTargetPx });
} catch (err) {
  fail(`Analysis failed. ${err.message}`);
}

if (args.screenshot) {
  report.summary.screenshot = args.screenshot;
}

if (args.json) {
  printJSON(report);
} else {
  const s = report.summary;
  console.log(`Accessibility / locator analysis (${s.automationName})`);
  console.log(`Elements analyzed: ${s.elementsAnalyzed}   Findings: ${s.findings}`);
  console.log(
    `By severity: ${Object.entries(s.bySeverity).map(([k, v]) => `${k}=${v}`).join('  ') || '(none)'}`
  );
  if (args.screenshot) console.log(`Screenshot: ${args.screenshot}`);
  console.log('');
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  const sorted = [...report.findings].sort(
    (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
  );
  for (const f of sorted) {
    const el = f.element;
    const idHint = el.resourceId || el.contentDesc || el.name || el.text || el.tagName;
    console.log(`[${f.severity.toUpperCase()}] ${f.rule}: ${f.message}`);
    console.log(`    element: ${el.tagName}  (${idHint})  path=${el.path}`);
    console.log(`    fix: ${f.suggestion}`);
  }
}
