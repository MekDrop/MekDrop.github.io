/**
 * Resolves the roof surface above a room-authored fireplace.
 */
export class KitchenChimneyLayout {
  /**
   * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
   * @param {{x:number,z:number,floorY:number}} item
   * @param {{x:number,y:number,z:number}} position
   * @param {number} rotation
   * @returns {number}
   */
  static height(buildPlan, item, position, rotation) {
    const yaw = rotation * Math.PI / 180;
    const x = position.x + Math.cos(yaw) * 0.028 - Math.sin(yaw) * 0.2073;
    const z = position.z - Math.sin(yaw) * 0.028 - Math.cos(yaw) * 0.2073;
    const plan = buildPlan.metadata.runtime.residential;
    let top = position.y + 1.65;
    for (const space of plan.spaces ?? []) {
      if (item.x >= space.minX && item.x <= space.maxX &&
        item.z >= space.minZ && item.z <= space.maxZ && space.height) {
        top = Math.max(top, space.floorY + space.height);
      }
    }
    for (const area of plan.walkableAreas ?? []) {
      if (item.x >= area.minX && item.x <= area.maxX &&
        item.z >= area.minZ && item.z <= area.maxZ) {
        top = Math.max(top, area.floorY);
      }
    }
    for (const roof of buildPlan.geometry?.decorations?.roofs ?? []) {
      const angle = roof.yaw * Math.PI / 180;
      const dx = x - roof.x;
      const dz = z - roof.z;
      const u = Math.abs(Math.cos(angle) * dx - Math.sin(angle) * dz) * 2 / roof.width;
      const v = Math.abs(Math.sin(angle) * dx + Math.cos(angle) * dz) * 2 / roof.depth;
      if (u <= 1 && v <= 1) {
        top = Math.max(top, roof.y + roof.height * (1 - Math.max(u, v)));
      }
    }
    if (top <= position.y + 1.65) {
      top = position.y + (plan.floorHeight ?? 3);
    }
    // The authored stone course has rounded edges. Embed its final course in
    // the covering slab instead of ending tangent to its nominal surface.
    return Math.max(0, top - position.y + 0.12);
  }
}
