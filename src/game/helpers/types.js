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

/**
 * @param {number} value
 * @returns {boolean}
 */
export function isPositiveFiniteNumber(value) {
  return Number.isFinite(value) && value > 0;
}

/**
 * Whether all supplied values are positive finite numbers. No values returns true.
 * @param {...number} values
 * @returns {boolean}
 */
export function arePositiveFiniteNumbers(...values) {
  return values.every(isPositiveFiniteNumber);
}
