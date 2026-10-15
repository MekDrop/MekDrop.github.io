/**
 * Whether every value is truthy. Empty iterables return true.
 * @template T
 * @param {Iterable<T>} values
 * @returns {boolean}
 */
export function everyTruthy(values) {
  for (const value of values) {
    if (!value) {
      return false;
    }
  }
  return true;
}

/**
 * Whether every array value is a finite number. Empty arrays return true.
 * @param {number[]} values
 * @returns {boolean}
 */
export function everyFiniteNumber(values) {
  return values.every(Number.isFinite);
}
