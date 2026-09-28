import tableUrl from "../../models/castle/leisure/tea-table.glb?url";
import chairUrl from "../../models/castle/leisure/tea-chair.glb?url";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../enum/CastleTerracePhase.js";

const DEFINITIONS = {
  table: { url: tableUrl, position: [0.65, 0, 3.1] },
  chair: { url: chairUrl, position: [-0.75, 0, 3.2] },
};
const TABLE_GRIPS = [
  [-0.415, 1.069, -0.468],
  [0.415, 1.069, -0.468],
];
const TABLE_GRIP_MIDPOINT = [0, 1.069, -0.468];
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
    return Object.values(DEFINITIONS).map(/**
     *
     * @param {{url: string}} options
     * @param {string} options.url
     */
    ({ url }) => url);
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
    const carryingTable = this.#behavior?.cargo === "table" && [
      PHASE.SERVANT_ENTER,
      PHASE.SERVANT_LEAVE,
    ].includes(this.#behavior?.stagePhase);
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
      prop.setLocalEulerAngles(0, name === "chair" ? 90 : 0, 0);
      prop.setLocalScale(1, name === "chair" ? 0.75 : 1, 1);
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
      name === "chair" ? 90 : 0,
      0,
    );
    prop.setLocalRotation(new this.#pc.Quat().slerp(
      this.#servant.entity.getLocalRotation(),
      floorRotation,
      progress,
    ));
    prop.enabled = this.#servant.entity.enabled;
  }

  /**
   *
   * @param {string} name
   */
  #carryPosition(name) {
    if (name === "table") {
      const left = this.#servant.leftHand.getPosition();
      const midpoint = left.clone().lerp(
        left,
        this.#servant.rightHand.getPosition(),
        0.5,
      );
      const offset = this.#servant.entity.getWorldTransform()
        .transformVector(new this.#pc.Vec3(...TABLE_GRIP_MIDPOINT));
      return this.#stage.getWorldTransform().clone().invert()
        .transformPoint(midpoint.sub(offset));
    }
    const world = this.#servant.entity.getWorldTransform().transformPoint(
      new this.#pc.Vec3(0, 0.55, 0.75),
    );
    return this.#stage.getWorldTransform().clone().invert().transformPoint(world);
  }

  #tableGripDistance() {
    const hands = [this.#servant.leftHand, this.#servant.rightHand];
    const grips = TABLE_GRIPS.map(/**
     *
     * @param {{x: number, y: number, z: number}} point
     */
    (point) => this.#props.table
      .getWorldTransform().transformPoint(new this.#pc.Vec3(...point)));
    const direct = grips[0].distance(hands[0].getPosition()) +
      grips[1].distance(hands[1].getPosition());
    const crossed = grips[0].distance(hands[1].getPosition()) +
      grips[1].distance(hands[0].getPosition());
    return Math.min(direct, crossed) / TABLE_GRIPS.length;
  }
}
