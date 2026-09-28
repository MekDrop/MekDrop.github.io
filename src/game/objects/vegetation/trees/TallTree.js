import tallTreeModelUrl from "../../../models/vegetation/tall-tree.glb?url";
import { Tree } from "../Tree.js";

export class TallTree extends Tree {
  /**
   *
    * @type {string}
   */
  static modelUrl = tallTreeModelUrl;
  /**
   *
    * @type {number}
   */
  static rowCount = 7;
  /**
   *
    * @type {number}
   */
  static cutsRequired = TallTree.rowCount;
  /**
   *
    * @type {number}
   */
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
      cells: [-1, 0, 1].flatMap(/**
       *
       * @param {number} x
       */
      (x) => [0, 1].map(/**
       *
       * @param {number} z
       */
      (z) => [x, z])),
    },
    { y: 6, cells: [[0, 0], [0, 1]] },
  ]);

  /**
   *
   * @param {ConstructorParameters<typeof Tree>[0]} options
   */
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
