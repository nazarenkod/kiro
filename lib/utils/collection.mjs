// Lifted from appium-mcp: src/utils/collection.ts (Apache-2.0)
// Adapted to plain Node ESM (types removed). See NOTICE.

export function isNil(value) {
  return value == null;
}

export function isEmpty(value) {
  if (value == null) {
    return true;
  }

  // Keep behavior aligned with lodash: primitives/functions are treated as empty.
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    typeof value === 'function'
  ) {
    return true;
  }

  if (typeof value === 'string') {
    return value.length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isArguments(value) || isTypedArrayLike(value)) {
    return value.length === 0;
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false;
}

export function omitNilValues(values) {
  const filteredValues = {};

  for (const [key, value] of Object.entries(values)) {
    if (!isNil(value)) {
      filteredValues[key] = value;
    }
  }

  return filteredValues;
}

function isLength(value) {
  return (
    typeof value === 'number' &&
    value >= 0 &&
    value % 1 === 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function isArguments(value) {
  return Object.prototype.toString.call(value) === '[object Arguments]';
}

function isTypedArrayLike(value) {
  if (!ArrayBuffer.isView(value)) {
    return false;
  }
  const maybeLength = value.length;
  return isLength(maybeLength);
}
