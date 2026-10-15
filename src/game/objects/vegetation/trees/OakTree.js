import oakModelUrl from "../../../models/vegetation/oak.glb?url";
import { Tree } from "../Tree.js";

export class OakTree extends Tree {
  /**
   *
   * @type {string}
   */
  static modelUrl = oakModelUrl;
  /**
   *
   * @type {number}
   */
  static rowCount = 6;
  /**
   *
   * @type {number}
   */
  static cutsRequired = OakTree.rowCount;
  /**
   *
   * @type {number}
   */
  static collisionRows = Object.freeze([
    {
      y: 0,
      cells: [[0, 0]],
    },
    {
      y: 1,
      cells: [[0, 0]],
    },
    {
      y: 2,
      cells: [[0, 0]],
    },
    {
      y: 3,
      cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
    },
    {
      y: 4,
      cells: [-1, 0, 1].flatMap(OakTree.#flatMapX),
    },
    {
      y: 5,
      cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]],
    },
  ]);

  /**
   *
   * @param {ConstructorParameters<typeof Tree>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      modelUrl: OakTree.modelUrl,
      variant: "oak",
      cutsRequired: OakTree.cutsRequired,
      collisionRows: OakTree.collisionRows,
    });
  }

  /**
   *
   * @param {number} x
   */
  static #flatMapX(x) {
    return [-1, 0, 1].map(/**
         *
         * @param {number} z
         */
      (z) => [x, z]);
  }
}
