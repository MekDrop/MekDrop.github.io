const MODULE_HEIGHT = 0.55;
const MODULE_STEP = 0.43;

const FACE_TRANSFORMS = {
  NORTH: { normalX: 0, normalZ: -1, tangentX: 1, tangentZ: 0, yaw: 180 },
  EAST: { normalX: 1, normalZ: 0, tangentX: 0, tangentZ: 1, yaw: 90 },
  SOUTH: { normalX: 0, normalZ: 1, tangentX: -1, tangentZ: 0, yaw: 0 },
  WEST: { normalX: -1, normalZ: 0, tangentX: 0, tangentZ: -1, yaw: -90 },
};

export function createCliffVineLayout(mapData) {
  const modules = [];
  for (const vine of mapData.cliffVineData ?? []) {
    const face = FACE_TRANSFORMS[vine.direction];
    if (!face) {
      continue;
    }
    const length = vine.topY - vine.bottomY;
    const moduleCount = Math.max(
      1,
      Math.ceil(Math.max(0, length - MODULE_HEIGHT) / MODULE_STEP) + 1,
    );
    const verticalScale =
      length / (MODULE_HEIGHT + (moduleCount - 1) * MODULE_STEP);
    const centerX = vine.col - (mapData.cols - 1) / 2;
    const centerZ = vine.row - (mapData.rows - 1) / 2;

    for (let index = 0; index < moduleCount; index += 1) {
      const tangentOffset =
        vine.offset + Math.sin(vine.phase + index * 1.7) * 0.025;
      const horizontalScale =
        0.92 + ((Math.round(vine.phase * 100) + index * 17) % 19) / 100;
      modules.push({
        x:
          centerX +
          face.normalX * 0.515 +
          face.tangentX * tangentOffset,
        y: vine.topY - index * MODULE_STEP * verticalScale,
        z:
          centerZ +
          face.normalZ * 0.515 +
          face.tangentZ * tangentOffset,
        yaw: face.yaw,
        scaleX: horizontalScale,
        scaleY: verticalScale,
        scaleZ: 0.9,
        topY: vine.topY,
        bottomY: vine.bottomY,
        moduleBottomY:
          vine.topY -
          (index * MODULE_STEP + MODULE_HEIGHT) * verticalScale,
      });
    }
  }
  return modules;
}
