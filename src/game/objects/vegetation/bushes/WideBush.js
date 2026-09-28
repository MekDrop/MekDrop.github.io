import wideBushModelUrl from "../../../models/vegetation/wide-bush.glb?url";
import { Bush } from "../Bush.js";

export class WideBush extends Bush {
  /**
   *
    * @type {string}
   */
  static modelUrl = wideBushModelUrl;
  /**
   *
    * @type {number}
   */
  static rowCount = 2;
  /**
   *
    * @type {number}
   */
  static cutsRequired = WideBush.rowCount;
  /**
   *
    * @type {number}
   */
  static collisionRows = Object.freeze([
    {
      y: 0,
      cells: [
        [-2, 0],
        [-1, 0],
        [0, 0],
        [1, 0],
        [2, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [0, -1],
        [1, -1],
      ],
    },
    { y: 1, cells: [[-1, 0], [0, 0], [1, 0]] },
  ]);

  /**
   *
   * @param {ConstructorParameters<typeof Bush>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      modelUrl: WideBush.modelUrl,
      variant: "wide-bush",
      cutsRequired: WideBush.cutsRequired,
      collisionRows: WideBush.collisionRows,
    });
  }
}
