import { RoyalWishFulfillment } from "./RoyalWishFulfillment.js";
import { TerraceDoorActions } from "./TerraceDoorActions.js";
import { TerraceServiceActions } from "./TerraceServiceActions.js";

/**
 * Connects the hero trigger, royal wishes, and participant-owned actions.
 */
export class CastleTerraceActivity {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [
      ...TerraceDoorActions.modelUrls,
      ...TerraceServiceActions.modelUrls,
    ];
  }

  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #stage;
  /**
   *
    * @type {string}
   */
  #kind;
  /**
   *
    * @type {import("./RoyalTerraceActivityBehavior.js").RoyalTerraceActivityBehavior}
   */
  #royalBehavior;
  /**
   *
    * @type {import("./TerraceServantBehavior.js").TerraceServantBehavior|null}
   */
  #servantBehavior;
  /**
   *
    * @type {RoyalWishFulfillment}
   */
  #wishFulfillment;
  /**
   *
    * @type {import("./TerraceRoyalActions.js").TerraceRoyalActions}
   */
  #royalActions;
  /**
   *
    * @type {TerraceServiceActions|null}
   */
  #serviceActions;
  /**
   *
    * @type {TerraceDoorActions}
   */
  #doorActions;
  /**
   *
    * @type {{x: number, y: number, z: number}}
   */
  #position;
  /**
   *
    * @type {Array<{side: string, offset: number, width: number, approachElevation?: number}>}
   */
  #doors;
  /**
   *
    * @type {boolean}
   */
  #triggered = false;
  /**
   *
    * @type {boolean}
   */
  #stopped = false;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: string, wallMaterial: import("playcanvas").Material, woodMaterial: import("playcanvas").Material, royal: import("../royal/AbstractRoyal.js").AbstractRoyal, servant: import("../servant/Servant.js").Servant, position: {x: number, y: number, z: number}, doors: Array<{side: string, offset: number, width: number, approachElevation?: number}>, layout: {x: number, y: number, z: number, yaw: number, depth: number, width: number}, onRoyalAtThroneChange: (atThrone: boolean) => void}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {string} options.modelLibrary
   * @param {import("playcanvas").Material} options.wallMaterial
   * @param {import("playcanvas").Material} options.woodMaterial
   * @param {import("../royal/AbstractRoyal.js").AbstractRoyal} options.royal
   * @param {import("../servant/Servant.js").Servant} options.servant
   * @param {{x: number, y: number, z: number}} options.position
   * @param {Array<{side: string, offset: number, width: number, approachElevation?: number}>} options.doors
   * @param {{x: number, y: number, z: number, yaw: number, depth: number, width: number}} options.layout
   * @param {(atThrone: boolean) => void} options.onRoyalAtThroneChange
   */
  constructor({
    pc,
    modelLibrary,
    wallMaterial,
    woodMaterial,
    royal,
    servant,
    position,
    doors,
    layout,
    onRoyalAtThroneChange,
  }) {
    this.#position = position;
    this.#doors = doors;
    this.#entity = new pc.Entity("Castle terrace activity");
    this.#entity.setLocalPosition(layout.x, layout.y, layout.z);
    this.#entity.setLocalEulerAngles(0, layout.yaw, 0);
    this.#stage = new pc.Entity("Terrace participants");
    const scale = Math.min(0.45, layout.depth / 5.5, layout.width / 4.2);
    this.#stage.setLocalScale(scale, scale, scale);
    this.#entity.addChild(this.#stage);
    const royalParticipant = royal.createTerraceParticipant({
      pc,
      modelLibrary,
      onRoyalAtThroneChange,
      stage: this.#stage,
    });
    this.#kind = royalParticipant.kind;
    this.#royalBehavior = royalParticipant.behavior;
    this.#royalActions = royalParticipant.actions;
    const servantParticipant = servant.createTerraceParticipant({
      pc,
      modelLibrary,
      layout,
      scale,
      kind: this.#kind,
      royal: this.#royalActions.actor,
    });
    this.#servantBehavior =
      this.#kind === "king" ? null : servantParticipant.behavior;
    this.#serviceActions =
      this.#kind === "king" ? null : servantParticipant.serviceActions;
    this.#wishFulfillment = new RoyalWishFulfillment(
      this.#royalBehavior,
      this.#servantBehavior,
    );
    this.#doorActions = new TerraceDoorActions({
      pc,
      modelLibrary,
      wallMaterial,
      woodMaterial,
      root: this.#entity,
      stage: this.#stage,
      scale,
      inspector: servantParticipant.inspector,
      canInspect: () => !this.#stopped,
    });
    const actionHandler = {
      enter: () => this.#syncParticipantActions(),
      update: () => this.#syncParticipantActions(),
      exit: () => this.#syncParticipantActions(),
    };
    this.#royalBehavior.actionHandler = actionHandler;
    if (this.#servantBehavior) {
      this.#servantBehavior.actionHandler = actionHandler;
    }
    this.#syncParticipantActions();
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
    * @returns {boolean}
   */
  get active() {
    return (
      this.#royalBehavior.active ||
      this.#servantBehavior?.active ||
      (this.#servantBehavior?.installedCount ?? 0) > 0
    );
  }

  /**
   *
    * @returns {import("src/game/objects/ObjectTypes.js").TerraceActivityState}
   */
  get state() {
    const behavior = this.#activeBehavior;
    const door = this.#doorActions.state;
    const royal = this.#royalActions.state;
    return {
      kind: this.#kind,
      phase: behavior.stagePhase,
      progress: behavior.progress,
      active: this.active,
      royalState: this.#royalBehavior.state,
      servantState: this.#servantBehavior?.state ?? null,
      triggered: this.#triggered,
      doorOpenAmount: door.openAmount,
      doorInspectionPhase: door.inspectionPhase,
      doorInspectionAnimation: door.inspectionAnimation,
      doorInspectorVisible: door.inspectorVisible,
      doorHandleGripDistance: door.handleGripDistance,
      royalPosition: royal.position,
      royalYaw: royal.yaw,
      ...(this.#serviceActions?.state ?? {
        trayVisible: false,
        tableGripDistance: null,
        bookOpenAmount: null,
        potHandDistance: null,
        cupLipDistance: null,
        cupLipClearance: null,
        saucerVisible: false,
      }),
    };
  }

  /**
   *
   * @param {number} value
   */
  setTriggered(value) {
    this.#triggered = Boolean(value);
    if (!this.#doorActions.inspecting) {
      this.#wishFulfillment.update(this.#triggered);
    }
  }

  /**
   *
   * @param {number} rayStart
   * @param {number} rayEnd
   */
  getPointerHit(rayStart, rayEnd) {
    return this.#stopped
      ? null
      : this.#doorActions.getPointerHit(rayStart, rayEnd);
  }

  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} radius
   */
  blocksCameraAt(x, y, z, radius = 0) {
    return this.#doorActions.blocksCameraAt(x, y, z, radius);
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} options
   * @param {number} options.x
   * @param {number} options.y
   * @param {number} options.z
   */
  isTriggerAt({ x, y, z }) {
    const position = this.#position;
    const inside =
      x >= position.x &&
      x <= position.x + position.width &&
      z >= position.z &&
      z <= position.z + position.depth;
    const distance = this.#triggered ? 2.4 : 1.7;
    const nearDoor = this.#doors.some(/**
     *
     * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} door
     */
    (door) => {
      const vertical = door.side === "WEST" || door.side === "EAST";
      const lateral = vertical ? z - position.z : x - position.x;
      const boundary =
        door.side === "WEST"
          ? position.x
          : door.side === "EAST"
            ? position.x + position.width
            : door.side === "NORTH"
              ? position.z
              : position.z + position.depth;
      return (
        Math.abs((vertical ? x : z) - boundary) <= distance &&
        lateral >= door.offset - 0.55 &&
        lateral <= door.offset + door.width + 0.55
      );
    });
    return (
      !this.#stopped &&
      (inside || nearDoor) &&
      Math.abs((y ?? position.elevation) - position.elevation) < 2
    );
  }

  /**
   *
   * @param {number} deltaTime
   */
  update(deltaTime) {
    if (this.#stopped) {
      return;
    }
    if (!this.#doorActions.inspecting) {
      this.#wishFulfillment.update(this.#triggered);
      this.#royalBehavior.update(deltaTime);
      this.#servantBehavior?.update(deltaTime);
      this.#wishFulfillment.update(this.#triggered);
    }
    this.#doorActions.update(deltaTime, this.#activeBehavior.stagePhase);
  }

  stop() {
    this.#stopped = true;
    this.#royalBehavior.reset();
    this.#servantBehavior?.reset();
    this.#syncParticipantActions();
    this.#doorActions.stop();
  }

  destroy() {
    this.#royalBehavior.reset();
    this.#servantBehavior?.reset();
    this.#royalBehavior.actionHandler = null;
    if (this.#servantBehavior) {
      this.#servantBehavior.actionHandler = null;
    }
    this.#doorActions.destroy();
    this.#entity.destroy();
  }

  /**
   *
    * @returns {number}
   */
  get #activeBehavior() {
    if (this.#royalBehavior.active) {
      return this.#royalBehavior;
    }
    return this.#servantBehavior?.active
      ? this.#servantBehavior
      : this.#royalBehavior;
  }

  #syncParticipantActions() {
    this.#stage.enabled = this.active;
    this.#royalActions.sync(this.#royalBehavior);
    if (this.#serviceActions) {
      this.#serviceActions.sync(this.#servantBehavior, this.#royalBehavior);
    }
  }
}
