import wideBushModelUrl from "../../../models/vegetation/wide-bush.glb?url";
import { Bush } from "../Bush.js";

export class WideBush extends Bush {
  static modelUrl = wideBushModelUrl;
  static rowCount = 2;
  static cutsRequired = WideBush.rowCount;
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
