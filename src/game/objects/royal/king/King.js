import kingModelUrl from "../../../models/castle/royals/king.glb?url";
import { CastleTerraceActivity } from "../../castle/CastleTerraceActivity.js";
import { KingTrainingBehavior } from "../../castle/KingTrainingBehavior.js";
import { TerraceKing } from "../../castle/TerraceKing.js";
import { AbstractRoyal } from "../AbstractRoyal.js";

export class King extends AbstractRoyal {
  static get modelUrls() {
    return [kingModelUrl, ...CastleTerraceActivity.modelUrls];
  }

  constructor(options) {
    super({
      ...options,
      modelUrl: kingModelUrl,
      RoyalType: TerraceKing,
      BehaviorType: KingTrainingBehavior,
    });
  }
}
