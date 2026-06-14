// Compact, readable view of a page-source tree (built on xmlToJSON).
// Drops noise: collapses wrapper layouts with no meaningful attributes and keeps
// only signal attributes (text/id/desc/name/label/value/clickable/bounds).
import { xmlToJSON } from './source-parsing.mjs';

/** Short tag name: drop package prefix and the XCUIElementType prefix. */
export function shortTag(tagName) {
  const last = tagName.split('.').pop() || tagName;
  return last.replace(/^XCUIElementType/, '');
}

/** Keep only the signal attributes, normalized to short keys. */
function signalAttrs(a = {}) {
  const out = {};
  if (a.text) out.text = a.text;
  const id = a['resource-id'] || a.id;
  if (id) out.id = id;
  if (a['content-desc']) out.desc = a['content-desc'];
  if (a.name) out.name = a.name;
  if (a.label && a.label !== a.name) out.label = a.label;
  if (a.value) out.value = a.value;
  if (a.clickable === 'true') out.clickable = true;
  if (a.bounds) {
    out.bounds = a.bounds;
  } else if (a.width != null && a.height != null) {
    out.bounds = `[${a.x || 0},${a.y || 0}][${Number(a.x || 0) + Number(a.width)},${Number(a.y || 0) + Number(a.height)}]`;
  }
  return out;
}

/** An element is "meaningful" if it carries any signal (label/id/text/interactive). */
function isMeaningful(node) {
  const a = node.attributes || {};
  return !!(
    a.text ||
    a['content-desc'] ||
    a['resource-id'] ||
    a.name ||
    a.label ||
    a.value ||
    a.clickable === 'true' ||
    a.focusable === 'true'
  );
}

/**
 * Recursively compact a node into zero or more compact nodes.
 * Wrapper nodes (not meaningful, <=1 kept child) are collapsed into their children.
 */
function compactNode(node, isRoot = false) {
  const kids = node.children.flatMap((c) => compactNode(c));
  const keep = isRoot || isMeaningful(node) || kids.length > 1;
  if (!keep) {
    return kids;
  }
  const out = { tag: shortTag(node.tagName), ...signalAttrs(node.attributes), path: node.path };
  if (kids.length) {
    out.children = kids;
  }
  return [out];
}

/** Build a compact tree from a parsed page-source tree. */
export function compactTree(tree) {
  const result = compactNode(tree, true);
  return result.length === 1 ? result[0] : { tag: 'root', children: result };
}

/** Convenience: XML string -> compact tree. */
export function xmlToCompact(sourceXML) {
  return compactTree(xmlToJSON(sourceXML));
}

/** Count nodes in a compact tree (for reporting size reduction). */
export function countNodes(node) {
  if (!node) return 0;
  const kids = node.children || [];
  return 1 + kids.reduce((n, c) => n + countNodes(c), 0);
}
