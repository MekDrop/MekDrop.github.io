export class MissingAnimationFrameTextureError extends Error {
  constructor(animationKey, frameIndex) {
    super(
      `Missing texture key for animation "${animationKey}" frame ${frameIndex}`,
    );
    this.name = this.constructor.name;
    this.animationKey = animationKey;
    this.frameIndex = frameIndex;
  }
}
