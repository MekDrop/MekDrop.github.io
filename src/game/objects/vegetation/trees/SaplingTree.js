import saplingModelUrl from "../../../models/vegetation/sapling.glb?url";
import { Tree } from "../Tree.js";

export class SaplingTree extends Tree {
  /**
   *
    * @type {string}
   */
  static modelUrl = saplingModelUrl;
  /**
   *
    * @type {number}
   */
  static rowCount = 4;
  /**
   *
    * @type {number}
   */
  static cutsRequired = SaplingTree.rowCount;
  /**
   *
    * @type {number}
   */
  static collisionRows = Object.freeze([
    { y: 0, cells: [[0, 0]] },
    { y: 1, cells: [[0, 0], [-1, 0], [1, 0], [0, -1]] },
    { y: 2, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    { y: 3, cells: [[0, 0], [1, 0]] },
  ]);

  /**
   *
   * @param {ConstructorParameters<typeof Tree>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      modelUrl: SaplingTree.modelUrl,
      variant: "sapling",
      cutsRequired: SaplingTree.cutsRequired,
      collisionRows: SaplingTree.collisionRows,
    });
  }
}
