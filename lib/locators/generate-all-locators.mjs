// Lifted from appium-mcp: src/locators/generate-all-locators.ts (Apache-2.0)
// Adapted to plain Node ESM (types removed, logger import rewired). See NOTICE.
//
// Generate locators for all elements from a page-source XML string.
import { getSuggestedLocators } from './locator-generation.mjs';
import { xmlToJSON } from './source-parsing.mjs';
import { shouldIncludeElement } from './element-filter.mjs';
import log from '../utils/log.mjs';

/**
 * @typedef {Object} ElementWithLocators
 * @property {string} tagName
 * @property {Record<string,string>} locators
 * @property {string} text
 * @property {string} contentDesc
 * @property {string} resourceId
 * @property {boolean} clickable
 * @property {boolean} enabled
 * @property {boolean} displayed
 * @property {string} path
 * @property {Record<string,string>} attributes
 */

/**
 * Main function to generate locators for all elements from sourceXML
 *
 * @param {string} sourceXML - The XML page source to process
 * @param {boolean} isNative - Whether this is a native context
 * @param {string} automationName - The automation driver name (uiautomator2, xcuitest, etc.)
 * @param {object} filters - Optional filters to apply when selecting elements
 * @returns {ElementWithLocators[]} Array of elements with their generated locators
 */
export function generateAllElementLocators(
  sourceXML,
  isNative = true,
  automationName,
  filters = {}
) {
  const sourceJSON = xmlToJSON(sourceXML);
  const results = [];

  if (sourceJSON) {
    traverseAndProcessElements(
      sourceJSON,
      sourceXML,
      isNative,
      automationName,
      filters,
      results
    );
  }

  return results;
}

/**
 * Transforms a JSONElement with locators into ElementWithLocators format
 */
function transformElementWithLocators(element, locators) {
  // Filter out any undefined or invalid entries before converting to object
  const validLocators = locators.filter(
    (locator) =>
      Array.isArray(locator) &&
      locator.length === 2 &&
      typeof locator[0] === 'string' &&
      typeof locator[1] === 'string'
  );

  return {
    tagName: element.tagName,
    locators: Object.fromEntries(validLocators),
    text: element.attributes.text || '',
    contentDesc: element.attributes['content-desc'] || '',
    resourceId: element.attributes['resource-id'] || '',
    clickable: element.attributes.clickable === 'true',
    enabled: element.attributes.enabled === 'true',
    displayed: element.attributes.displayed === 'true',
    // extra context (not in original) so callers/agents can match elements by description
    path: element.path,
    attributes: element.attributes,
  };
}

/**
 * Processes a single element: generates locators if it passes filters
 */
function processElement(element, sourceXML, isNative, automationName, filters, results) {
  if (!shouldIncludeElement(element, filters, isNative, automationName)) {
    return;
  }

  try {
    const strategyMap = getSuggestedLocators(
      element,
      sourceXML,
      isNative,
      automationName
    );
    results.push(transformElementWithLocators(element, strategyMap));
  } catch (error) {
    log.error(
      `Error generating locators for element at path ${element.path}:`,
      error
    );
  }
}

/**
 * Recursively traverses the element tree and processes each element
 */
function traverseAndProcessElements(
  element,
  sourceXML,
  isNative,
  automationName,
  filters,
  results
) {
  if (!element) {
    return;
  }

  // Process current element
  processElement(element, sourceXML, isNative, automationName, filters, results);

  // Recursively process children (even if parent was filtered out)
  if (element.children && element.children.length > 0) {
    element.children.forEach((child) =>
      traverseAndProcessElements(
        child,
        sourceXML,
        isNative,
        automationName,
        filters,
        results
      )
    );
  }
}
