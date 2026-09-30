/**
 * Groups map-local props by authored tile without changing their local transforms.
 */
export class IslandObjectRoots {
  /**
   * @type {import("playcanvas").Entity[]}
   */
  #roots = [];
  /**
   * @type {Set<string>[]}
   */
  #cells = [];
  /**
   * @type {import("playcanvas").Entity}
   */
  #parent;

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} parent
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  constructor(pc, parent, mapData) {
    this.#parent = parent;
    const connector = mapData?.islandConnectorData;
    if (!connector) return;
    this.#cells = [connector.nearIsland, connector.farIsland].map(
      /**
       * @param {string[]} cells
       */
      (cells) => new Set(cells),
    );
    this.#roots = [new pc.Entity("Near island props"), new pc.Entity("Far island props")];
    for (const root of this.#roots) parent.addChild(root);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {{col: number, row: number}} tile
   */
  addChild(entity, tile) {
    const key = `${tile?.col},${tile?.row}`;
    const group = this.#cells.findIndex(
      /**
       * @param {Set<string>} cells
       */
      (cells) => cells.has(key),
    );
    (this.#roots[group] ?? this.#parent).addChild(entity);
  }

  /**
   * @param {number} near
   * @param {number} far
   */
  setOffsets(near, far) {
    this.#roots[0]?.setLocalPosition(0, near, 0);
    this.#roots[1]?.setLocalPosition(0, far, 0);
  }
}
