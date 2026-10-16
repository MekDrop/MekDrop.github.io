import princessModelUrl from "../../../../models/castle/royals/princess.glb?url";
import { CastleTerraceActivity } from "../../../castle/rooms/terrace/CastleTerraceActivity.js";
import { PrincessLeisureBehavior } from "../../../castle/residents/PrincessLeisureBehavior.js";
import { TerracePrincess } from "../../../castle/rooms/terrace/TerracePrincess.js";
import { AbstractRoyal } from "../AbstractRoyal.js";

export class Princess extends AbstractRoyal {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [princessModelUrl, ...CastleTerraceActivity.modelUrls];
  }

  /**
   *
   * @param {ConstructorParameters<typeof AbstractRoyal>[0]} options
   */
  constructor(options) {
    super({
      ...options,
      modelUrl: princessModelUrl,
      RoyalType: TerracePrincess,
      BehaviorType: PrincessLeisureBehavior,
    });
  }
}
