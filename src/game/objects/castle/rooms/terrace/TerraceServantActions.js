import servantUrl from "../../../../models/castle/leisure/servant.glb?url";
import { CHARACTER_HEIGHT } from "../../../../config/character-size.js";
import elderServantUrl from "../../../../models/castle/leisure/elder-servant.glb?url";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../../../enum/CastleTerracePhase.js";
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
   * @type {import("../../residents/CastleResidentMotion.js").CastleResidentMotion|null}
   */
  #motion = null;
  /**
   * @type {import("playcanvas").Entity}
   */
  #stage;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, stage: import("playcanvas").Entity}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Entity} options.stage
   */
  constructor({ pc, modelLibrary, stage, actor = null, motion = null }) {
    this.#stage = stage;
    this.#motion = motion;
    if (actor) {
      this.#servant = actor;

      return;
    }
    for (const modelUrl of TerraceServantActions.modelUrls) {
      const actor = new TerraceActor({
        pc,
        modelLibrary,
        modelUrl,
        kind: "servant",
      });
      actor.entity.name = "Terrace servant standby";
      const scale = CHARACTER_HEIGHT / (actor.height * stage.getLocalScale().y);
      actor.entity.setLocalScale(scale, scale, scale);
      actor.entity.enabled = false;
      stage.addChild(actor.entity);
      this.#servants.push(actor);
    }
    this.#servant = this.#servants[0];
  }

  /**
   * @returns {boolean}
   */
  get arrived() {
    return this.#motion?.arrived ?? true;
  }

  get actor() {
    return this.#servant;
  }

  /**
   *
   * @param {import("./TerraceServantBehavior.js").TerraceServantBehavior} behavior
   */
  sync(behavior) {
    if (behavior.reacting) {
      return;
    }
    if (this.#motion) {
      this.#syncResident(behavior);

      return;
    }
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
    this.#servant.behavior = behavior;
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

  /**
   * @param {import("./TerraceServantBehavior.js").TerraceServantBehavior} behavior
   */
  #syncResident(behavior) {
    this.#servant.behavior = behavior;
    const phase = behavior.stagePhase;
    const enter = [PHASE.SERVANT_ENTER, PHASE.SERVANT_RETURN].includes(phase);
    const leave = [PHASE.SERVANT_EXIT, PHASE.SERVANT_LEAVE].includes(phase);
    if (enter || leave) {
      // Resident bodies use world scale independently of the furniture stage.
      // Leave space for the table/daybed that will appear during furnishing.
      const approach = 3.1 + CHARACTER_HEIGHT * 0.55 / this.#stage.getWorldTransform().getScale().z;
      const target = behavior.cargo === "chair" ? [-0.75, 0, approach]
        : behavior.cargo === "sunbed" ? [0, 0, approach] : [0.65, 0, approach];
      const point = this.#servant.entity.getPosition().clone().set(...target);
      this.#motion.moveTo(leave ? this.#motion.home
        : this.#stage.getWorldTransform().transformPoint(point, point), behavior.action);
      if (this.#motion.arrived) {
        this.#servant.pose(behavior.action === "carry" ? "carry" : "idle", behavior.elapsed);
      }
    } else if ([PHASE.FURNISH, PHASE.POUR, PHASE.PACK].includes(phase)) {
      this.#servant.pose(behavior.action, phase === PHASE.POUR ? behavior.elapsed
        : 2 * (phase === PHASE.PACK ? 1 - behavior.progress : behavior.progress));
    }
  }

  destroy() {
    for (const servant of this.#servants) {
      servant.destroy();
    }
    this.#servants = [];
    this.#servant = null;
  }
}
