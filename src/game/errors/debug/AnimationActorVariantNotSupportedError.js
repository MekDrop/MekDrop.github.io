export class AnimationActorVariantNotSupportedError extends Error {
  constructor({ object, variant }) {
    super(
      `Animation actor variant "${variant}" is not supported for "${object}".`,
    );
    this.name = this.constructor.name;
  }
}
