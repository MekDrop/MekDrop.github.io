import kingModelUrl from "../../../../models/castle/royals/king.glb?url";
import { CastleTerraceActivity } from "../../../castle/rooms/terrace/CastleTerraceActivity.js";
import { KingTrainingBehavior } from "../../../castle/residents/KingTrainingBehavior.js";
import { TerraceKing } from "../../../castle/rooms/terrace/TerraceKing.js";
import { AbstractRoyal } from "../AbstractRoyal.js";
import { CastleAudio } from "../../../../audio/castle/CastleAudio.js";

export class King extends AbstractRoyal {
  /**
   * @returns {string[]}
   */
  static get audioUrls() {
    return [CastleAudio.stoneStep1.wavUrl, CastleAudio.stoneStep2.wavUrl];
  }
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
