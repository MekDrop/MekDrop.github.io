import kingModelUrl from "../../../models/castle/royals/king.glb?url";
import { CastleTerraceActivity } from "../../castle/CastleTerraceActivity.js";
import { KingTrainingBehavior } from "../../castle/KingTrainingBehavior.js";
import { TerraceKing } from "../../castle/TerraceKing.js";
import { AbstractRoyal } from "../AbstractRoyal.js";

export class King extends AbstractRoyal {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [kingModelUrl, ...CastleTerraceActivity.modelUrls];
  }

  /**
   *
   * @param {ConstructorParameters<typeof AbstractRoyal>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      modelUrl: kingModelUrl,
      RoyalType: TerraceKing,
      BehaviorType: KingTrainingBehavior,
    });
  }
}
