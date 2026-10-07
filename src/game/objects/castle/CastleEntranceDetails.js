import lanternUrl from "../../models/castle/residential/entrance-lantern.glb?url";
import masonryUrl from "../../models/castle/residential/masonry-block.glb?url";
import planterUrl from "../../models/castle/residential/terrace-planter.glb?url";

/**
 * Imported entrance lighting and corner courses for authored castle shells.
 */
export class CastleEntranceDetails {
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [lanternUrl, masonryUrl, planterUrl]; }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} parent
   * @param {import("../../GameContracts.js").CastleBuildPlan} plan
   * @param {import("playcanvas").Material} stoneMaterial
   */
  static add(pc, models, parent, plan, stoneMaterial) {
    const residential = plan.metadata.runtime.residential;
    const { origin, floorHeight } = residential;
    const entrance = residential.openings.find(/**
     * @param {{exteriorEntrance:boolean}} opening
     */
    opening => opening.exteriorEntrance);
    if (!entrance) { return; }
    const angle = origin.yaw * Math.PI / 180;
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number[]} scale
     * @param {string} name
     */
    const addStone = (x, y, z, scale, name) => {
      const stone = models.instantiate(masonryUrl);
      stone.name = name;
      stone.setLocalPosition(origin.x + Math.cos(angle) * x + Math.sin(angle) * z,
        y, origin.z - Math.sin(angle) * x + Math.cos(angle) * z);
      stone.setLocalEulerAngles(0, origin.yaw, 0);
      stone.setLocalScale(...scale);
      for (const render of stone.findComponents("render")) {
        for (const mesh of render.meshInstances) { mesh.material = stoneMaterial; }
      }
      parent.addChild(stone);
    };
    for (const flank of [-1, 1]) {
      const offset = flank * (entrance.width / 2 + 0.65);
      const x = origin.x + Math.cos(angle) * offset - Math.sin(angle) * 0.35;
      const z = origin.z - Math.sin(angle) * offset - Math.cos(angle) * 0.35;
      const lantern = models.instantiate(lanternUrl);
      lantern.name = "Castle entrance wall lantern";
      lantern.setLocalPosition(x, origin.y + 1.3, z);
      lantern.setLocalEulerAngles(0, origin.yaw + 180, 0);
      parent.addChild(lantern);
      const light = new pc.Entity("Castle entrance lantern light");
      light.setLocalPosition(x - Math.sin(angle) * 0.25, origin.y + 1.67,
        z - Math.cos(angle) * 0.25);
      light.addComponent("light", { type: "omni", color: new pc.Color(1, 0.38, 0.06),
        intensity: 0.85, range: 2.2, castShadows: false });
      parent.addChild(light);
    }
    for (const building of residential.buildings) {
      if (building.floorY > origin.y) { continue; }
      for (const x of [building.minX, building.maxX]) {
        for (const z of [building.minZ, building.maxZ]) {
          for (let y = 0.125; y < floorHeight; y += 0.25) {
            const width = y % 0.5 < 0.25 ? 0.44 : 0.34;
            const depth = y % 0.5 < 0.25 ? 0.34 : 0.44;
            // Keep the alternating courses outside both interior wall faces.
            addStone(x + (x === building.minX ? -width / 2 : width / 2),
              origin.y + y, z + (z === building.minZ ? -depth / 2 : depth / 2),
              [width, 0.248, depth], "Castle ground floor corner trim");
          }
        }
      }
      // Recess the trim beneath the floor: its top otherwise shares the
      // masonry's plane and flickers as the floating island moves.
      const bandY = origin.y + floorHeight - 0.125 - 0.002;
      for (const z of [building.minZ - 0.2, building.maxZ + 0.2]) {
        for (let x = building.minX; x < building.maxX; x += 0.5) {
          const width = Math.min(0.5, building.maxX - x);
          addStone(x + width / 2, bandY, z, [width, 0.25, 0.4], "Castle terrace support band");
        }
      }
      for (const x of [building.minX - 0.2, building.maxX + 0.2]) {
        for (let z = building.minZ; z < building.maxZ; z += 0.5) {
          const depth = Math.min(0.5, building.maxZ - z);
          addStone(x, bandY, z + depth / 2, [0.4, 0.25, depth], "Castle terrace support band");
        }
      }
    }
    for (const terrace of residential.spaces) {
      if (terrace.kind !== "terrace" || terrace.maxX - terrace.minX < 2 || terrace.maxZ - terrace.minZ < 2) { continue; }
      for (const x of [terrace.minX + 0.6, terrace.maxX - 0.6]) {
        const z = terrace.minZ + 0.6;
        const planter = models.instantiate(planterUrl);
        planter.name = "Castle terrace boxwood planter";
        planter.setLocalPosition(origin.x + Math.cos(angle) * x + Math.sin(angle) * z,
          terrace.floorY, origin.z - Math.sin(angle) * x + Math.cos(angle) * z);
        planter.setLocalEulerAngles(0, origin.yaw, 0);
        planter.addComponent("collision", { type: "box", halfExtents: new pc.Vec3(0.33, 0.23, 0.33),
          linearOffset: new pc.Vec3(0, 0.23, 0) });
        planter.addComponent("rigidbody", { type: "static", friction: 0.8, restitution: 0 });
        for (const render of planter.findComponents("render")) {
          for (const mesh of render.meshInstances) {
            if (mesh.material.name === "Terrace planter sandstone") { mesh.material = stoneMaterial; }
          }
        }
        parent.addChild(planter);
      }
    }
  }
}
