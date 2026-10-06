const MODEL_HEIGHT = 1.663;

const FACE_TRANSFORMS = {
  NORTH: { normalX: 0, normalZ: -1, tangentX: 1, tangentZ: 0, yaw: 180 },
  EAST: { normalX: 1, normalZ: 0, tangentX: 0, tangentZ: 1, yaw: 90 },
  SOUTH: { normalX: 0, normalZ: 1, tangentX: -1, tangentZ: 0, yaw: 0 },
  WEST: { normalX: -1, normalZ: 0, tangentX: 0, tangentZ: -1, yaw: -90 },
};

/**
 * Fit continuous authored trails to an exposed cliff, anchored at its grass lip.
 * @param {import("src/game/objects/ObjectTypes.js").GameMapData} mapData
 */
export function createCliffVineLayout(mapData) {
  const modules = [];
  for (const vine of mapData.cliffVineData ?? []) {
    const face = FACE_TRANSFORMS[vine.direction];
    if (!face) {
      continue;
    }
    const topY = mapData.heightmap?.[vine.row]?.[vine.col] ?? vine.topY;
    const footY = mapData.heightmap?.[vine.row + face.normalZ]?.[vine.col + face.normalX];
    const bottomY = Number.isFinite(footY) && topY - footY <= 1.25
      ? footY + 0.025
      : vine.bottomY;
    const length = topY - bottomY;
    const centerX = vine.col - (mapData.cols - 1) / 2;
    const centerZ = vine.row - (mapData.rows - 1) / 2;
    modules.push({
      col: vine.col,
      row: vine.row,
      x: centerX + face.normalX * 0.515 + face.tangentX * vine.offset,
      y: topY,
      z: centerZ + face.normalZ * 0.515 + face.tangentZ * vine.offset,
      yaw: face.yaw,
      scaleX: vine.width / 0.16,
      scaleY: length / MODEL_HEIGHT,
      scaleZ: 1,
      topY,
      bottomY,
      moduleBottomY: bottomY,
    });
  }
  return modules;
}
