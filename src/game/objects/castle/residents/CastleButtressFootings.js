import { CastleResidentialLayout } from "./CastleResidentialLayout.js";

/**
 * Grounds each existing buttress footprint on the lowest touched terrain tile.
 * @param {import("../../../GameContracts.js").CastleBuildPlan} plan
 * @param {import("../../../GameContracts.js").GameMapData} mapData
 */
export const createCastleButtressFootings = (plan, mapData) => {
  const layout = new CastleResidentialLayout(plan);
  const footings = [];
  for (const placement of layout.exteriorButtresses) {
    const width = 0.6 * placement.scale.x;
    const depth = 0.6 * placement.scale.z;
    const heights = [];
    for (const dx of [-width / 2 + 0.001, 0, width / 2 - 0.001]) {
      for (const dz of [-depth / 2 + 0.001, 0, depth / 2 - 0.001]) {
        const col = Math.floor(placement.position.x + dx + mapData.cols / 2);
        const row = Math.floor(placement.position.z + dz + mapData.rows / 2);
        const height = mapData.heightmap?.[row]?.[col];
        if (Number.isFinite(height)) {
          heights.push(height);
        }
      }
    }
    if (!heights.length) {
      continue;
    }
    const baseY = Math.min(...heights);
    const topY = placement.position.y;
    if (topY > baseY + 0.001) {
      footings.push({
        x: placement.position.x,
        z: placement.position.z,
        baseY,
        topY,
        width,
        depth,
      });
    }
  }

  return footings;
};
