#!/usr/bin/env node
// Convert an Appium page-source XML into a readable JSON tree.
// Wraps xmlToJSON (lifted from appium-mcp src/locators/source-parsing.ts).
//
// Usage:
//   node source-to-json.mjs --in source.xml [--out tree.json] [--compact] [--depth N]
//   cat source.xml | node source-to-json.mjs --compact
// Options:
//   --compact    smaller, readable view: only meaningful elements + key attributes
//                (text/id/desc/name/label/bounds), wrapper layouts collapsed
//   --depth <n>  prune the full tree below depth n (children replaced by a count)
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs, readStdin, fail } from '../../../../lib/cli.mjs';
import { xmlToJSON } from '../../../../lib/locators/source-parsing.mjs';
import { compactTree, countNodes } from '../../../../lib/locators/compact-source.mjs';

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

let tree;
try {
  tree = xmlToJSON(xml);
} catch (err) {
  fail(`Failed to convert page source. ${err.message}`);
}

let result;
if (args.compact) {
  result = compactTree(tree);
  console.error(`Compact tree: ${countNodes(result)} nodes (from ${xml.length} bytes of XML)`);
} else {
  const maxDepth = args.depth != null ? parseInt(args.depth, 10) : null;
  result = maxDepth != null ? prune(tree) : tree;
}

const json = JSON.stringify(result, null, 2);

if (args.out) {
  await writeFile(args.out, json + '\n', 'utf-8');
  console.error(`Wrote JSON tree to ${args.out}`);
} else {
  process.stdout.write(json + '\n');
}

function prune(node, depth = 0) {
  const maxDepth = parseInt(args.depth, 10);
  const out = {
    tagName: node.tagName,
    path: node.path,
    attributes: node.attributes,
  };
  if (depth >= maxDepth && node.children.length > 0) {
    out.truncatedChildren = node.children.length;
    out.children = [];
  } else {
    out.children = node.children.map((c) => prune(c, depth + 1));
  }
  return out;
}
