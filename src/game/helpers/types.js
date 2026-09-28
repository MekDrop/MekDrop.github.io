/**
 *
 * @param {number} value
 */
export function isFunction(value) {
  return typeof value === "function";
}

/**
 *
 * @param {number} value
 */
export function isArray(value) {
  return Array.isArray(value);
}

/**
 *
 * @param {number} value
 */
export function isNumber(value) {
  return typeof value === "number";
}

/**
 *
 * @param {number} value
 */
export function isString(value) {
  return typeof value === "string";
}

/**
 *
 * @param {number} value
 */
export function isObject(value) {
  return value !== null && typeof value === "object" && !isArray(value);
}
