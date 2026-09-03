export class MissingAnimationTextureError extends Error {
  constructor(animationKey, textureKey) {
    super(`Missing texture for animation "${animationKey}": ${textureKey}`);
    this.name = this.constructor.name;
    this.animationKey = animationKey;
    this.textureKey = textureKey;
  }
}
