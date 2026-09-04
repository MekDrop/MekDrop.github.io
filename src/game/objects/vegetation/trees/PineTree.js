import pineModelUrl from "../../../models/vegetation/pine.glb?url";
import { Tree } from "../Tree.js";

export class PineTree extends Tree {
  static modelUrl = pineModelUrl;
  static rowCount = 6;
  static cutsRequired = PineTree.rowCount;
  static collisionRows = Object.freeze([
    { y: 0, cells: [[0, 0]] },
    { y: 1, cells: [[0, 0]] },
    {
      y: 2,
      cells: [-1, 0, 1].flatMap((x) =>
        [-1, 0, 1].map((z) => [x, z]),
      ),
    },
    { y: 3, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    { y: 4, cells: [[0, 0], [-1, 0], [0, 1]] },
    { y: 5, cells: [[0, 0]] },
  ]);

  constructor(options) {
    super({
      ...options,
      modelUrl: PineTree.modelUrl,
      variant: "pine",
      cutsRequired: PineTree.cutsRequired,
      collisionRows: PineTree.collisionRows,
    });
  }
}
