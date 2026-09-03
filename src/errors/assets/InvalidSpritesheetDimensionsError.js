export class InvalidSpritesheetDimensionsError extends Error {
  constructor() {
    super(
      "addAnimationFromSpritesheet requires frameWidth/frameHeight or columns/rows",
    );
    this.name = this.constructor.name;
  }
}
