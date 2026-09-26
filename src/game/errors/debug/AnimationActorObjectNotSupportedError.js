export class AnimationActorObjectNotSupportedError extends Error {
  constructor({ object }) {
    super(`Animation actor object "${object}" is not supported.`);
    this.name = this.constructor.name;
  }
}
