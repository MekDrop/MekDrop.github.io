export class VirtualItemObjectNotSupportedError extends Error {
  constructor({ object }) {
    super(`Virtual item object "${object}" is not supported.`);
    this.name = this.constructor.name;
  }
}
