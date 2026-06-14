// New module (not from appium-mcp): pure accessibility / locator-quality
// analysis over an Appium page-source XML. Builds on the lifted locator
// pipeline (generateAllElementLocators) so it shares the same element model.
import { generateAllElementLocators } from '../locators/generate-all-locators.mjs';

function isIOS(automationName) {
  return automationName === 'xcuitest' || automationName === 'mac2';
}

/** Parse element bounds into {x,y,width,height} for Android or iOS sources. */
export function parseBounds(attrs) {
  if (attrs.bounds) {
    // Android: bounds="[x1,y1][x2,y2]"
    const m = attrs.bounds.match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);
    if (m) {
      const [x1, y1, x2, y2] = m.slice(1).map(Number);
      return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }
  }
  if (attrs.width != null && attrs.height != null) {
    // iOS: x/y/width/height attributes
    return {
      x: Number(attrs.x || 0),
      y: Number(attrs.y || 0),
      width: Number(attrs.width),
      height: Number(attrs.height),
    };
  }
  return null;
}

const IOS_INTERACTIVE = [
  'XCUIElementTypeButton',
  'XCUIElementTypeSwitch',
  'XCUIElementTypeTextField',
  'XCUIElementTypeSecureTextField',
  'XCUIElementTypeCell',
  'XCUIElementTypeLink',
];

const ANDROID_INTERACTIVE = [
  'Button',
  'ImageButton',
  'EditText',
  'CheckBox',
  'RadioButton',
  'Switch',
  'ToggleButton',
];

function isInteractive(el, ios) {
  const a = el.attributes || {};
  if (ios) {
    return IOS_INTERACTIVE.some((t) => el.tagName.includes(t));
  }
  return (
    a.clickable === 'true' ||
    a.focusable === 'true' ||
    ANDROID_INTERACTIVE.some((t) => el.tagName.includes(t))
  );
}

function isImage(el) {
  return /Image|ImageView|ImageButton/.test(el.tagName);
}

/** Accessible (user-facing) name for the element, platform-aware. */
function accessibleName(el, ios) {
  const a = el.attributes || {};
  if (ios) {
    return a.name || a.label || '';
  }
  return a['content-desc'] || a.text || '';
}

/** Is the only way to locate this element a brittle strategy (xpath / class name)? */
function hasOnlyBrittleLocators(locators) {
  const keys = Object.keys(locators || {});
  if (keys.length === 0) {
    return true;
  }
  const robust = keys.filter(
    (k) => k !== 'xpath' && k !== 'class name'
  );
  return robust.length === 0;
}

/**
 * Analyze a page-source XML for accessibility issues and locator quality.
 *
 * @param {string} sourceXML
 * @param {object} [opts]
 * @param {string} [opts.automationName='uiautomator2'] - 'uiautomator2' | 'xcuitest'
 * @param {boolean} [opts.isNative=true]
 * @param {number} [opts.minTouchTargetPx=40] - minimum recommended touch target (px)
 * @returns {{summary: object, findings: Array<object>}}
 */
export function analyzeAccessibility(sourceXML, opts = {}) {
  const automationName = opts.automationName || 'uiautomator2';
  const isNative = opts.isNative !== false;
  const minTouchTargetPx = opts.minTouchTargetPx ?? 40;
  const ios = isIOS(automationName);

  const elements = generateAllElementLocators(
    sourceXML,
    isNative,
    automationName
  );

  // Count attribute values to detect duplicates (ambiguous locators).
  const idCounts = new Map();
  const nameCounts = new Map();
  for (const el of elements) {
    const a = el.attributes || {};
    const id = a['resource-id'] || '';
    if (id) idCounts.set(id, (idCounts.get(id) || 0) + 1);
    const name = ios ? a.name || a.label || '' : a['content-desc'] || '';
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  const findings = [];
  const add = (severity, rule, message, el, suggestion) => {
    const a = el.attributes || {};
    findings.push({
      severity,
      rule,
      message,
      suggestion,
      element: {
        tagName: el.tagName,
        path: el.path,
        resourceId: el.resourceId || '',
        contentDesc: el.contentDesc || '',
        text: el.text || '',
        name: a.name || '',
        label: a.label || '',
      },
      locators: el.locators,
    });
  };

  for (const el of elements) {
    const a = el.attributes || {};
    const interactive = isInteractive(el, ios);
    const name = accessibleName(el, ios);
    const bounds = parseBounds(a);

    // 1) Interactive element without an accessible name
    if (interactive && !name) {
      add(
        'high',
        'missing-accessible-name',
        `Interactive ${el.tagName} has no accessible name (${ios ? 'name/label' : 'content-desc/text'}).`,
        el,
        ios
          ? 'Set an accessibilityIdentifier/label on this control.'
          : 'Set android:contentDescription (or visible text) on this control.'
      );
    }

    // 2) Image without a description
    if (isImage(el) && !name) {
      add(
        'medium',
        'image-missing-description',
        `${el.tagName} has no text alternative.`,
        el,
        ios
          ? 'Add an accessibility label to the image.'
          : 'Add android:contentDescription to the image.'
      );
    }

    // 3) Small touch target
    if (interactive && bounds && (bounds.width < minTouchTargetPx || bounds.height < minTouchTargetPx)) {
      add(
        'medium',
        'small-touch-target',
        `Touch target is ${bounds.width}x${bounds.height}px, below the recommended ${minTouchTargetPx}px.`,
        el,
        'Increase the tappable area (min ~48dp).'
      );
    }

    // 4) Disabled-but-interactive
    if (interactive && a.enabled === 'false') {
      add(
        'info',
        'disabled-interactive',
        `Interactive ${el.tagName} is disabled (enabled=false).`,
        el,
        'Confirm the control is intended to be disabled on this screen.'
      );
    }

    // 5) Hidden but interactive
    const hidden = ios ? a.visible === 'false' : a.displayed === 'false';
    if (interactive && hidden) {
      add(
        'info',
        'hidden-interactive',
        `Interactive ${el.tagName} is not visible but present in the tree.`,
        el,
        'It may be off-screen; scrolling or a wait may be required to interact.'
      );
    }

    // 6) Duplicate id / accessible name (ambiguous locator)
    const id = a['resource-id'] || '';
    if (id && idCounts.get(id) > 1) {
      add(
        'medium',
        'duplicate-id',
        `resource-id "${id}" is shared by ${idCounts.get(id)} elements.`,
        el,
        'Disambiguate with an index or a more specific locator, or fix duplicate ids in the app.'
      );
    } else if (name && nameCounts.get(name) > 1 && interactive) {
      add(
        'low',
        'duplicate-accessible-name',
        `Accessible name "${name}" is shared by ${nameCounts.get(name)} elements.`,
        el,
        'Make the accessible name unique so the control can be targeted reliably.'
      );
    }

    // 7) Brittle locator only (no stable id / accessibility id)
    if (interactive && hasOnlyBrittleLocators(el.locators)) {
      add(
        'medium',
        'brittle-locator',
        `Only xpath/class-name locators are available for this ${el.tagName}.`,
        el,
        'Add a stable resource-id / accessibilityIdentifier to make automation robust.'
      );
    }
  }

  const bySeverity = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: {
      automationName,
      elementsAnalyzed: elements.length,
      findings: findings.length,
      bySeverity,
    },
    findings,
  };
}
