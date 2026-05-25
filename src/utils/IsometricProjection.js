export const ISOMETRIC_ANGLE = Math.PI / 6; // 30 degrees
export const ISO_COS = Math.cos(ISOMETRIC_ANGLE);
export const ISO_SIN = Math.sin(ISOMETRIC_ANGLE);

export class IsometricCamera {
  constructor(options = {}) {
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.zoom = options.zoom ?? 1;
    this.tiltAmount = options.tiltAmount ?? 0.5;
  }

  worldToScreen(worldX, worldY, basePixelScale = 8) {
    const scale = basePixelScale * this.zoom;

    const screenX = (worldX - worldY) * ISO_COS * scale;
    const screenY = (worldX + worldY) * ISO_SIN * scale * this.tiltAmount;

    return {
      x: screenX + this.x,
      y: screenY + this.y,
    };
  }

  screenToWorld(screenX, screenY, basePixelScale = 8) {
    const scale = basePixelScale * this.zoom;
    const localX = screenX - this.x;
    const localY = screenY - this.y;

    const worldX = (localX / (ISO_COS * scale) + localY / (ISO_SIN * scale * this.tiltAmount)) * 0.5;
    const worldY = (localY / (ISO_SIN * scale * this.tiltAmount) - localX / (ISO_COS * scale)) * 0.5;

    return { x: worldX, y: worldY };
  }

  centerOnObject(objX, objY, screenCenterX, screenCenterY, basePixelScale = 8) {
    const screen = this.worldToScreen(objX, objY, basePixelScale);
    this.x = screenCenterX - screen.x;
    this.y = screenCenterY - screen.y;
  }
}

export const getIsometricDepthSort = (screenY) => screenY;

export const getIsometricSpritePosition = (worldX, worldY, camera, basePixelScale, spriteHeight = 0) => {
  const screenCoords = camera.worldToScreen(worldX, worldY, basePixelScale);
  return {
    x: screenCoords.x,
    y: screenCoords.y - spriteHeight * basePixelScale,
  };
};
