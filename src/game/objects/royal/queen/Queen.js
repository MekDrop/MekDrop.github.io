import queenModelUrl from "../../../models/castle/royals/queen.glb?url";
import { CastleTerraceActivity } from "../../castle/CastleTerraceActivity.js";
import { QueenLeisureBehavior } from "../../castle/QueenLeisureBehavior.js";
import { TerraceQueen } from "../../castle/TerraceQueen.js";
import { AbstractRoyal } from "../AbstractRoyal.js";

export class Queen extends AbstractRoyal {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [queenModelUrl, ...CastleTerraceActivity.modelUrls];
  }

  /**
   *
   * @param {ConstructorParameters<typeof AbstractRoyal>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      modelUrl: queenModelUrl,
      RoyalType: TerraceQueen,
      BehaviorType: QueenLeisureBehavior,
    });
  }
}
