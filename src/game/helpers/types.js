export function isFunction(value) {
  return typeof value === "function";
}

export function isArray(value) {
  return Array.isArray(value);
}

export function isNumber(value) {
  return typeof value === "number";
}

export function isString(value) {
  return typeof value === "string";
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !isArray(value);
}
