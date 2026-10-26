import tableUrl from "../../../../models/castle/leisure/tea-table.glb?url";
import chairUrl from "../../../../models/chair/chair.glb?url";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../../../enum/CastleTerracePhase.js";
import { TerracePropGrip } from "./TerracePropGrip.js";

const DEFINITIONS = {
  table: {
    url: tableUrl,
    position: [0.65, 0, 3.1],
  },
  chair: {
    url: chairUrl,
    position: [-0.75, 0, 3.2],
    grips: [[-0.19, 0.385, 0], [0.19, 0.385, 0]],
  },
};
const TABLE_GRIPS = [
  [-0.25, 1.069, -0.573],
  [0.25, 1.069, -0.573],
];
/**
 *
 * @param {number} value
 */
const ease = (value) => value * value * (3 - 2 * value);

/**
 * Executes table and chair transport actions for tea service.
 */
export class TerraceFurnitureActions {
  /**
   *
   * @returns {number}
   */
  static get modelUrls() {
    return Object.values(DEFINITIONS).map(TerraceFurnitureActions.#map);
  }

  /**
   *
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   *
   * @type {import("playcanvas").Entity}
   */
  #stage;
  /**
   *
   * @type {Record<string, import("playcanvas").Entity>}
   */
  #props = {};
  /**
   *
   * @type {import("./TerraceActor.js").TerraceActor|null}
   */
  #servant = null;
  /**
   *
   * @type {import("./TerraceServantBehavior.js").TerraceServantBehavior|null}
   */
  #behavior = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, stage: import("playcanvas").Entity}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Entity} options.stage
   */
  constructor({ pc, modelLibrary, stage }) {
    this.#pc = pc;
    this.#stage = stage;
    for (const [name, definition] of Object.entries(DEFINITIONS)) {
      const prop = modelLibrary.instantiate(definition.url);
      prop.name = `Terrace ${name}`;
      stage.addChild(prop);
      this.#props[name] = prop;
    }
  }

  /**
   *
   * @returns {import("src/game/objects/ObjectTypes.js").TerraceActivityState}
   */
  get state() {
    const carryingTable = this.#behavior?.cargo === "table" && [PHASE.SERVANT_ENTER, PHASE.SERVANT_LEAVE]
      .includes(this.#behavior?.stagePhase);

    return {
      tableGripDistance: carryingTable ? this.#tableGripDistance() : null,
    };
  }

  /**
   *
   * @param {import("./TerraceServantBehavior.js").TerraceServantBehavior} behavior
   * @param {import("./TerraceActor.js").TerraceActor} servant
   */
  sync(behavior, servant) {
    this.#behavior = behavior;
    this.#servant = servant;
    const phase = behavior.stagePhase;
    const placing = phase === PHASE.FURNISH;
    const packing = phase === PHASE.PACK;
    const carrying = [PHASE.SERVANT_ENTER, PHASE.SERVANT_LEAVE]
      .includes(phase);
    for (const [name, definition] of Object.entries(DEFINITIONS)) {
      const prop = this.#props[name];
      const installed = ["table", "chair"].indexOf(name) <
        behavior.installedCount;
      const moving = behavior.cargo === name &&
        (placing || packing || carrying);
      prop.enabled = installed || moving;
      prop.setLocalPosition(...definition.position);
      prop.setLocalEulerAngles(0, name === "chair" ? 180 : 0, 0);
      prop.setLocalScale(1, 1, 1);
      if (moving) {
        this.#move(name, prop, definition.position, placing, packing);
      }
    }
  }

  /**
   *
   * @param {string} name
   * @param {import("playcanvas").Entity} prop
   * @param {Array<number>} floor
   * @param {boolean} placing
   * @param {boolean} packing
   */
  #move(name, prop, floor, placing, packing) {
    const carry = this.#carryPosition(name);
    const progress = placing
      ? ease(this.#behavior.progress)
      : packing ? 1 - ease(this.#behavior.progress) : 0;
    prop.setLocalPosition(
      carry.x + (floor[0] - carry.x) * progress,
      carry.y + (floor[1] - carry.y) * progress,
      carry.z + (floor[2] - carry.z) * progress,
    );
    const floorRotation = new this.#pc.Quat().setFromEulerAngles(
      0,
      name === "chair" ? 180 : 0,
      0,
    );
    prop.setLocalRotation(new this.#pc.Quat().slerp(
      this.#stage.getRotation().clone().invert().mul(this.#servant.carryRotation ?? this.#servant.entity.getRotation())
        .mul(new this.#pc.Quat().setFromEulerAngles(name === "table" ? -155 : 0, name === "table" ? 180 : 0, 0)),
      floorRotation,
      progress,
    ));
    prop.enabled = this.#servant.entity.enabled;
    TerracePropGrip.align(this.#pc, prop, this.#servant,
      name === "table" ? TABLE_GRIPS : DEFINITIONS.chair.grips,
      null, 1,
      name === "table" ? TABLE_GRIPS.map(/**
       * @param {number[]} grip
       */ grip => [-grip[2], 0, grip[0]]) : null);
  }

  /**
   *
   * @param {string} name
   */
  #carryPosition(name) {
    return TerracePropGrip.carryPosition(
      this.#pc, this.#stage, this.#props[name], this.#servant,
      name === "table" ? TABLE_GRIPS : DEFINITIONS.chair.grips,
      null, name === "table" ? 0.045 : 0.025,
      name === "table" ? -155 : 0,
      name === "table" ? 180 : 0,
    );
  }

  #tableGripDistance() {
    const hands = [this.#servant.leftHand, this.#servant.rightHand];
    const grips = TABLE_GRIPS.map(this.#mapPoint.bind(this));
    const direct = grips[0].distance(hands[0].getPosition()) +
      grips[1].distance(hands[1].getPosition());
    const crossed = grips[0].distance(hands[1].getPosition()) +
      grips[1].distance(hands[0].getPosition());

    return Math.min(direct, crossed) / TABLE_GRIPS.length;
  }

  /**
   *
   * @param {{url: string}} options
   * @param {string} options.url
   */
  static #map({ url }) {
    return url;
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} point
   */
  #mapPoint(point) {
    return this.#props.table
      .getWorldTransform().transformPoint(new this.#pc.Vec3(...point));
  }
}
