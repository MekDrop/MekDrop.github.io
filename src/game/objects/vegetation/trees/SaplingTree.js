import saplingModelUrl from "../../../models/vegetation/sapling.glb?url";
import { Tree } from "../Tree.js";

export class SaplingTree extends Tree {
  static modelUrl = saplingModelUrl;
  static rowCount = 4;
  static cutsRequired = SaplingTree.rowCount;
  static collisionRows = Object.freeze([
    { y: 0, cells: [[0, 0]] },
    { y: 1, cells: [[0, 0], [-1, 0], [1, 0], [0, -1]] },
    { y: 2, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    { y: 3, cells: [[0, 0], [1, 0]] },
  ]);

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
