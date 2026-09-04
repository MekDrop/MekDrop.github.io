import tallTreeModelUrl from "../../../models/vegetation/tall-tree.glb?url";
import { Tree } from "../Tree.js";

export class TallTree extends Tree {
  static modelUrl = tallTreeModelUrl;
  static rowCount = 7;
  static cutsRequired = TallTree.rowCount;
  static collisionRows = Object.freeze([
    { y: 0, cells: [[0, 0]] },
    { y: 1, cells: [[0, 0]] },
    { y: 2, cells: [[0, 0]] },
    { y: 3, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    {
      y: 4,
      cells: [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, 1],
        [1, -1],
      ],
    },
    {
      y: 5,
      cells: [-1, 0, 1].flatMap((x) => [0, 1].map((z) => [x, z])),
    },
    { y: 6, cells: [[0, 0], [0, 1]] },
  ]);

  constructor(options) {
    super({
      ...options,
      modelUrl: TallTree.modelUrl,
      variant: "tall-tree",
      cutsRequired: TallTree.cutsRequired,
      collisionRows: TallTree.collisionRows,
    });
  }
}
