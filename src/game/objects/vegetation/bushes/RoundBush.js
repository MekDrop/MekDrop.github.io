import roundBushModelUrl from "../../../models/vegetation/round-bush.glb?url";
import { Bush } from "../Bush.js";

export class RoundBush extends Bush {
  /**
   *
    * @type {string}
   */
  static modelUrl = roundBushModelUrl;
  /**
   *
    * @type {number}
   */
  static rowCount = 3;
  /**
   *
    * @type {number}
   */
  static cutsRequired = RoundBush.rowCount;
  /**
   *
    * @type {number}
   */
  static collisionRows = Object.freeze([
    {
      y: 0,
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
    { y: 1, cells: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
    { y: 2, cells: [[0, 0]] },
  ]);

  /**
   *
   * @param {ConstructorParameters<typeof Bush>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      modelUrl: RoundBush.modelUrl,
      variant: "round-bush",
      cutsRequired: RoundBush.cutsRequired,
      collisionRows: RoundBush.collisionRows,
    });
  }
}
