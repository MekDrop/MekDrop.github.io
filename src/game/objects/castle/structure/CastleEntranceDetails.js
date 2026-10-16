import masonryUrl from "../../../models/castle/residential/masonry-block.glb?url";

/**
 * Imported entrance lighting and corner courses for authored castle shells.
 */
export class CastleEntranceDetails {
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [masonryUrl];
  }

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} parent
   * @param {import("../../../GameContracts.js").CastleBuildPlan} plan
   * @param {import("playcanvas").Material} stoneMaterial
   */
  static add(pc, models, parent, plan, stoneMaterial) {
    const residential = plan.metadata.runtime.residential;
    const { origin, floorHeight } = residential;
    const entrance = residential.openings.find(
      CastleEntranceDetails.#findOpening,
    );
    if (!entrance) {
      return;
    }
    const angle = origin.yaw * Math.PI / 180;
    // Bury inward trim faces beneath the shell rather than sharing its plane.
    const faceClearance = 0.004;
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number[]} scale
     * @param {string} name
     */
    const addStone = (x, y, z, scale, name) => {
      // A facade detail becomes indoor geometry when another building joins
      // this face. Keep all corner courses and bands outside the joined shell.
      /**
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number,height?:number}} building
       */
      const overlapsBuilding = building => Math.min(x + scale[0] / 2, building.maxX) > Math.max(x - scale[0] / 2, building.minX) + 1e-6 &&
        Math.min(z + scale[2] / 2, building.maxZ) > Math.max(z - scale[2] / 2, building.minZ) + 1e-6 &&
        Math.min(y + scale[1] / 2, building.floorY + (building.height ?? floorHeight)) > Math.max(y - scale[1] / 2, building.floorY) + 1e-6;
      if (residential.buildings.some(overlapsBuilding)) {
        return;
      }
      const stone = models.instantiate(masonryUrl);
      stone.name = name;
      stone.setLocalPosition(origin.x + Math.cos(angle) * x + Math.sin(angle) * z,
        y, origin.z - Math.sin(angle) * x + Math.cos(angle) * z);
      stone.setLocalEulerAngles(0, origin.yaw, 0);
      stone.setLocalScale(...scale);
      for (const render of stone.findComponents("render")) {
        for (const mesh of render.meshInstances) {
          mesh.material = stoneMaterial;
        }
      }
      parent.addChild(stone);
    };
    for (const building of residential.buildings) {
      if (building.floorY > origin.y) {
        continue;
      }
      CastleEntranceDetails.#addCorner(building, floorHeight, addStone, faceClearance, origin, building.minX, building.minZ);
      CastleEntranceDetails.#addCorner(building, floorHeight, addStone, faceClearance, origin, building.minX, building.maxZ);
      CastleEntranceDetails.#addCorner(building, floorHeight, addStone, faceClearance, origin, building.maxX, building.minZ);
      CastleEntranceDetails.#addCorner(building, floorHeight, addStone, faceClearance, origin, building.maxX, building.maxZ);
      // Recess the trim beneath the floor: its top otherwise shares the
      // masonry's plane and flickers as the floating island moves.
      const bandY = origin.y + floorHeight - 0.125 - 0.002;
      CastleEntranceDetails.#addHorizontalBand(building, addStone, bandY, building.minZ - 0.2 - faceClearance);
      CastleEntranceDetails.#addHorizontalBand(building, addStone, bandY, building.maxZ + 0.2 + faceClearance);
      CastleEntranceDetails.#addVerticalBand(building, addStone, bandY, building.minX - 0.2 - faceClearance);
      CastleEntranceDetails.#addVerticalBand(building, addStone, bandY, building.maxX + 0.2 + faceClearance);
    }
  }

  /**
   * @param {{exteriorEntrance:boolean}} opening
   */
  static #findOpening(opening) {
    return opening.exteriorEntrance;
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}&{floorY:number}} building
   * @param {number} floorHeight
   * @param {(x:number,y:number,z:number,scale:number[],name:string)=>void} addStone
   * @param {number} faceClearance
   * @param {{x:number,y:number,z:number}} origin
   * @param {number} x
   * @param {number} z
   */
  static #addCorner(
    building,
    floorHeight,
    addStone,
    faceClearance,
    origin,
    x,
    z,
  ) {
    for (let y = 0.125; y < floorHeight; y += 0.25) {
      const width = y % 0.5 < 0.25 ? 0.44 : 0.34;
      const depth = y % 0.5 < 0.25 ? 0.34 : 0.44;
      // Keep the alternating courses outside both interior wall faces.
      addStone(x + (x === building.minX ? -width / 2 - faceClearance : width / 2 + faceClearance),
        origin.y + y, z + (z === building.minZ ? -depth / 2 - faceClearance : depth / 2 + faceClearance),
        [width, 0.248, depth], "Castle ground floor corner trim");
    }
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}&{floorY:number}} building
   * @param {(x:number,y:number,z:number,scale:number[],name:string)=>void} addStone
   * @param {number} bandY
   * @param {number} z
   */
  static #addHorizontalBand(building, addStone, bandY, z) {
    for (let x = building.minX; x < building.maxX; x += 0.5) {
      const width = Math.min(0.5, building.maxX - x);
      addStone(x + width / 2, bandY, z, [width, 0.25, 0.4], "Castle terrace support band");
    }
  }

  /**
   * @param {{minX:number,maxX:number,minZ:number,maxZ:number}&{floorY:number}} building
   * @param {(x:number,y:number,z:number,scale:number[],name:string)=>void} addStone
   * @param {number} bandY
   * @param {number} x
   */
  static #addVerticalBand(building, addStone, bandY, x) {
    for (let z = building.minZ; z < building.maxZ; z += 0.5) {
      const depth = Math.min(0.5, building.maxZ - z);
      addStone(x, bandY, z + depth / 2, [0.4, 0.25, depth], "Castle terrace support band");
    }
  }
}
