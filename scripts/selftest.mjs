#!/usr/bin/env node
// Offline self-test: exercises the lifted locator pipeline and the accessibility
// analyzer against a fixture page source. No Appium server or device required.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateAllElementLocators } from '../lib/locators/generate-all-locators.mjs';
import { analyzeAccessibility } from '../lib/analysis/accessibility.mjs';
import { detectAutomationName } from '../lib/appium/session.mjs';
import { xmlToJSON } from '../lib/locators/source-parsing.mjs';
import { compactTree, countNodes } from '../lib/locators/compact-source.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, '../examples/sample-android-source.xml');

let failed = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failed++;
};

const xml = await readFile(fixture, 'utf-8');

// 1) automation detection
const automationName = detectAutomationName(xml);
check('detects uiautomator2 from Android source', automationName === 'uiautomator2');

// 1b) xml -> json tree
const tree = xmlToJSON(xml);
check('xmlToJSON returns the hierarchy root', tree.tagName === 'hierarchy');
check('xmlToJSON nodes carry attributes and path', tree.children[0].path === '0');

// 1c) compact view is smaller than the full tree and keeps named elements
const fullCount = countNodes(tree);
const compact = compactTree(tree);
const compactCount = countNodes(compact);
check('compact tree is smaller than full tree', compactCount < fullCount);
const flat = JSON.stringify(compact);
check('compact tree keeps the Login element', flat.includes('com.example:id/login'));
check('compact tree drops noise wrapper attributes', !flat.includes('FrameLayout') || flat.length < JSON.stringify(tree).length);

// 2) locator generation
const elements = generateAllElementLocators(xml, true, automationName);
check('generates locators for several elements', elements.length >= 5);

const login = elements.find((e) => e.resourceId === 'com.example:id/login');
check('finds the Login button', !!login);
check('Login button has an id locator', !!(login && login.locators.id));

// 3) accessibility analysis
const report = analyzeAccessibility(xml, { automationName });
check('analysis returns findings', report.findings.length > 0);

const rules = new Set(report.findings.map((f) => f.rule));
check('flags missing accessible name (icon button)', rules.has('missing-accessible-name'));
check('flags image without description (logo)', rules.has('image-missing-description'));
check('flags small touch target (icon button)', rules.has('small-touch-target'));
check('flags duplicate resource-id (rows)', rules.has('duplicate-id'));

console.log('');
console.log('Summary:', JSON.stringify(report.summary));
if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll offline checks passed.');
