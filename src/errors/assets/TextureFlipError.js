export class TextureFlipError extends Error {
  constructor(textureKey, animationKey) {
    super(
      `Failed to flip texture "${textureKey}" for animation "${animationKey}"`,
    );
    this.name = this.constructor.name;
    this.textureKey = textureKey;
    this.animationKey = animationKey;
  }
}
