import princessModelUrl from "../../../../models/castle/royals/princess.glb?url";
import { TerraceActor } from "./TerraceActor.js";

/**
 * Owns the princess model and her terrace-specific pose entry points.
 */
export class TerracePrincess {
  /**
   *
    * @returns {string}
   */
  static get kind() {
    return "princess";
  }

  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return princessModelUrl;
  }

  /**
   *
    * @type {TerraceActor|null}
   */
  #actor;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   */
  constructor({ pc, modelLibrary }) {
    this.#actor = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: princessModelUrl,
      kind: TerracePrincess.kind,
    });
  }

  /**
   * @returns {import("playcanvas").Entity}
   */
  get model() {
    return this.#actor.model;
  }

  /**
   * @returns {import("../../../shared/NpcStateMachine.js").NpcStateMachine}
   */
  get behavior() {
    return this.#actor.behavior;
  }

  /**
   * @param {import("../../../shared/NpcStateMachine.js").NpcStateMachine} value
   */
  set behavior(value) {
    this.#actor.behavior = value;
  }

  /**
   * @returns {import("playcanvas").Entity}
   */
  get entity() {
    return this.#actor.entity;
  }

  /**
   * Resume travel from the visible doorway sidestep.
   * @returns {boolean}
   */
  settleNavigationOffset() {
    return this.#actor.settleNavigationOffset();
  }

  /**
   *
    * @returns {number}
   */
  get rightHand() {
    return this.#actor.rightHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get leftHand() {
    return this.#actor.leftHand;
  }

  /**
   *
    * @returns {import("playcanvas").Entity|null}
   */
  get head() {
    return this.#actor.head;
  }

  /**
   *
    * @returns {number}
   */
  get height() {
    return this.#actor.height;
  }

  /**
   * World distance between the chair anchor and the sit clip's standing start.
   * The wider standing hem needs this clearance before the skirt gathers.
   * @returns {number}
   */
  get sittingApproachDistance() {
    return 0.7 * this.model.getWorldTransform().getScale().z;
  }

  /**
   * Transfer the completed stand-up clip's horizontal offset into navigation.
   */
  settleStandingPose() {
    const posture = this.model.findByName("Royal animation rig").getPosition();
    const position = this.entity.getPosition().clone();
    position.x = posture.x;
    position.z = posture.z;
    this.entity.setPosition(position);
    this.pose("idle", 0);
  }

  /**
   *
   * @param {string} action
   * @param {number} time
   * @param {number} blend
   */
  pose(action, time = 0, blend = 1) {
    this.#actor.pose(action, time, blend);
  }

  destroy() {
    this.#actor.destroy();
    this.#actor = null;
  }
}
