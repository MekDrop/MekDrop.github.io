/**
 * Storage occupies the open half beside and underneath the upper spiral,
 * leaving the doorway and lower flight's approach on the opposite side.
 */
export class SpiralStairStorage {
  /**
   * @param {import("../../CastleRoundTower.js").RoundTowerDefinition|undefined} tower
   * @param {"x"|"z"|null} [mirrorAxis] Compensates for the compiler's reflection;
   * the spiral itself retains its handedness in reflected castles.
   * @returns {import("../../../../objects/ObjectTypes.js").MapObjectDefinition[]}
   */
  static furnish(tower, mirrorAxis = null) {
    if (!tower || tower.radius - tower.wallThickness < 2.7) {
      return [];
    }
    const items = [];
    const stacks = [
      ["Crate", "Crate", "PotteryJar"],
      ["Chest", "Crate", "Crate"],
      ["Barrel"],
      ["Crate", "Crate", "WaterBucket"],
    ];
    const spacing = (tower.radius - tower.wallThickness) / 2.75;
    for (let column = 0; column < 3; column++) {
      for (let row = 0; row < 8; row++) {
        const dx = (-1.04 - column * 0.65) * spacing;
        const dz = (-2.1 + row * 0.6) * spacing;
        const stack = stacks[(column * 8 + row) % stacks.length];
        // Reserve the widest base's complete footprint, including wall cuts.
        const halfX = stack[0] === "Chest" ? 0.315 : 0.25;
        const ceiling = this.#ceiling(tower, dx, dz, halfX, 0.25);
        let y = 0.002;
        for (const [tier, object] of stack.entries()) {
          const scale = tier === 2 ? 0.8 : 0.9;
          const height = {
            Chest: 0.32914,
            Crate: 0.4702,
            Barrel: 0.65,
            PotteryJar: 0.3,
            WaterBucket: 0.4,
          }[object] * scale;
          if (y + height + 0.15 > ceiling) {
            break;
          }
          items.push({
            id: `spiral-storage-${column}-${row}-${tier}`,
            object,
            position: {
              x: tower.center[0] + (mirrorAxis === "x" ? -dx : dx),
              y,
              z: tower.center[1] + (mirrorAxis === "z" ? -dz : dz),
            },
            scale,
            rotation: object === "Chest" ? 0 : (row + tier) * 90,
            weathering: 0.6,
          });
          y += height;
        }
      }
    }

    return items;
  }

  /**
   * The round tower's 240-degree flight starts at 90 degrees, with the same
   * 12-degree, 20 cm treads as its authored castle spiral. Check the complete
   * footprint against their undersides, rather than excluding all floor below.
   * @param {import("../../CastleRoundTower.js").RoundTowerDefinition} tower
   * @param {number} x
   * @param {number} z
   * @param {number} halfX
   * @param {number} halfZ
   * @returns {number}
   */
  static #ceiling(tower, x, z, halfX, halfZ) {
    let ceiling = (tower.terraceElevation ?? 4) - 0.25;
    for (const dx of [-halfX, halfX]) {
      for (const dz of [-halfZ, halfZ]) {
        const across = x + dx;
        const along = z + dz;
        const radius = Math.hypot(across, along);
        if (radius > tower.radius - tower.wallThickness - 0.02 || across > -0.65) {
          return 0;
        }
        if (radius <= 1.77) {
          const angle = (Math.atan2(across, along) * 180 / Math.PI - 90 + 360) % 360;
          if (angle < 240) {
            ceiling = Math.min(ceiling, Math.floor(angle / 12) * 0.2);
          }
        }
      }
    }

    return ceiling;
  }
}
