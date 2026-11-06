import { State } from "yuka";

/**
 * One complete model-authored exercise or recovery action.
 * @abstract
 */
export class KingTrainingActionState extends State {
  /**
   * @type {string}
   */
  #clip;

  /**
   * @param {string} clip
   */
  constructor(clip) {
    super();

    this.#clip = clip;
  }

  get clip() {
    return this.#clip;
  }

  /**
   * @param {import("../../../../rooms/terrace/KingTrainingRoutine.js").KingTrainingRoutine} owner
   */
  execute(owner) {
    owner.completeAction(this);
  }
}
