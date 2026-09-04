import oakModelUrl from "../../../models/vegetation/oak.glb?url";
import { Tree } from "../Tree.js";

export class OakTree extends Tree {
  static modelUrl = oakModelUrl;
  static rowCount = 6;
  static cutsRequired = OakTree.rowCount;
  static collisionRows = Object.freeze([
    { y: 0, cells: [[0, 0]] },
    { y: 1, cells: [[0, 0]] },
    { y: 2, cells: [[0, 0]] },
    { y: 3, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    {
      y: 4,
      cells: [-1, 0, 1].flatMap((x) =>
        [-1, 0, 1].map((z) => [x, z]),
      ),
    },
    { y: 5, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
  ]);

  constructor(options) {
    super({
      ...options,
      modelUrl: OakTree.modelUrl,
      variant: "oak",
      cutsRequired: OakTree.cutsRequired,
      collisionRows: OakTree.collisionRows,
    });
  }
}
