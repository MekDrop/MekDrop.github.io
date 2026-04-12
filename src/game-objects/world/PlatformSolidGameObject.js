import { GameObject } from "src/game-objects/core/GameObject";

export class PlatformSolidGameObject extends GameObject {
  constructor(solid = {}) {
    super({
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      kind: "flyingPlatform",
      ...solid,
    });
  }
}
