import princessModelUrl from "../../../models/castle/royals/princess.glb?url";
import { CastleTerraceActivity } from "../../castle/CastleTerraceActivity.js";
import { PrincessLeisureBehavior } from "../../castle/PrincessLeisureBehavior.js";
import { TerracePrincess } from "../../castle/TerracePrincess.js";
import { AbstractRoyal } from "../AbstractRoyal.js";

export class Princess extends AbstractRoyal {
  static get modelUrls() {
    return [princessModelUrl, ...CastleTerraceActivity.modelUrls];
  }

  constructor(options) {
    super({
      ...options,
      modelUrl: princessModelUrl,
      RoyalType: TerracePrincess,
      BehaviorType: PrincessLeisureBehavior,
    });
  }
}
