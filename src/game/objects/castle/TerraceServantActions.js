import servantUrl from "../../models/castle/leisure/servant.glb?url";
import elderServantUrl from "../../models/castle/leisure/elder-servant.glb?url";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../enum/CastleTerracePhase.js";
import { TerraceActor } from "./TerraceActor.js";
import { syncTerraceWalk } from "./TerraceMovement.js";

/**
 * Executes movement and animation for whichever servant accepts a wish.
 */
export class TerraceServantActions {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [servantUrl, elderServantUrl];
  }

  /**
   *
    * @type {Array<TerraceActor>}
   */
  #servants = [];
  /**
   *
    * @type {TerraceActor|null}
   */
  #servant;
  /**
   *
    * @type {number}
   */
  #visit = -1;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, stage: import("playcanvas").Entity}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Entity} options.stage
   */
  constructor({ pc, modelLibrary, stage }) {
    for (const modelUrl of TerraceServantActions.modelUrls) {
      const actor = new TerraceActor({
        pc,
        modelLibrary,
        modelUrl,
        kind: "servant",
      });
      actor.entity.name = "Terrace servant standby";
      actor.entity.enabled = false;
      stage.addChild(actor.entity);
      this.#servants.push(actor);
    }
    this.#servant = this.#servants[0];
  }

  get actor() {
    return this.#servant;
  }

  /**
   *
   * @param {import("./TerraceServantBehavior.js").TerraceServantBehavior} behavior
   */
  sync(behavior) {
    if (this.#visit !== behavior.visitId) {
      this.#visit = behavior.visitId;
      for (const servant of this.#servants) {
        servant.entity.enabled = false;
        servant.entity.name = "Terrace servant standby";
      }
      this.#servant = this.#servants[
        Math.floor(Math.random() * this.#servants.length)
      ];
      this.#servant.entity.name = "Terrace servant";
    }
    const phase = behavior.stagePhase;
    const visible = [PHASE.SERVANT_ENTER, PHASE.FURNISH, PHASE.POUR,
      PHASE.SERVANT_EXIT, PHASE.SERVANT_RETURN, PHASE.PACK,
      PHASE.SERVANT_LEAVE].includes(phase);
    this.#servant.entity.enabled = visible;
    if (!visible) {
      return;
    }
    const target = behavior.cargo === "chair" ? [-0.75, 0, 2.25]
      : behavior.cargo === "sunbed" ? [0, 0, 1.55] : [0.65, 0, 2.1];
    if ([PHASE.SERVANT_ENTER, PHASE.SERVANT_RETURN, PHASE.SERVANT_EXIT,
      PHASE.SERVANT_LEAVE].includes(phase)) {
      syncTerraceWalk({
        actor: this.#servant,
        target,
        leaving: [PHASE.SERVANT_EXIT, PHASE.SERVANT_LEAVE].includes(phase),
        behavior,
        action: behavior.action,
      });
      return;
    }
    this.#servant.entity.setLocalPosition(...target);
    this.#servant.entity.setLocalEulerAngles(0, 0, 0);
    this.#servant.pose(
      behavior.action,
      phase === PHASE.POUR
        ? behavior.elapsed
        : 2 * (phase === PHASE.PACK
          ? 1 - behavior.progress : behavior.progress),
    );
  }

  destroy() {
    for (const servant of this.#servants) {
      servant.destroy();
    }
    this.#servants = [];
    this.#servant = null;
  }
}
