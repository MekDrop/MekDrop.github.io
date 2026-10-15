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
    const roofClearance = 3 * 0.24;
    for (const space of plan.spaces ?? []) {
      if (item.x >= space.minX && item.x <= space.maxX &&
        item.z >= space.minZ && item.z <= space.maxZ && space.height) {
        // Terraces are exposed roof surfaces, not rooms with another ceiling above them.
        top = Math.max(top, space.floorY + (space.kind === "terrace" ? 0 : space.height));
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
        // The authored blue roof is a gable: its ridge extends along x.
        // Each tile course adds up to 6% above the continuous depth slope.
        top = Math.max(top, roof.y + roof.height * Math.min(1, 1 - v + 0.06));
      }
    }
    if (top <= position.y + 1.65) {
      top = position.y + (plan.floorHeight ?? 3);
    }
    return Math.max(0, top - position.y + roofClearance);
  }
  /**
   * @param {import("../../GameContracts.js").CastleBuildPlan} buildPlan
   * @param {{x:number,z:number,floorY:number}} item
   * @param {{x:number,y:number,z:number}} position
   * @param {number} height
   * @returns {boolean}
   */
  static hasTerraceTerminal(buildPlan, item, position, height) {
    return (buildPlan.metadata.runtime.residential.spaces ?? []).some(/**
     * @param {{kind:string,minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} space
     */ space => space.kind === "terrace" && item.x >= space.minX && item.x <= space.maxX &&
      item.z >= space.minZ && item.z <= space.maxZ && Math.abs(space.floorY + 0.72 - position.y - height) < 1e-6);
  }

}
