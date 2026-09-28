import { CastleTerraceActivity } from "../castle/CastleTerraceActivity.js";
import { SeatedRoyal } from "../castle/SeatedRoyal.js";
import { TerraceRoyalActions } from "../castle/TerraceRoyalActions.js";

/**
 * Shared map-object lifecycle for a royal resident.
 *
 * @abstract
 */
export class AbstractRoyal {
  /**
   *
    * @type {import("playcanvas").EventHandle|null}
   */
  #definition;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {SeatedRoyal}
   */
  #audienceActor;
  /**
   *
    * @type {CastleTerraceActivity}
   */
  #activity = null;
  /**
   *
    * @type {import("../castle/CastleAudienceRoom.js").CastleAudienceRoom|null}
   */
  #audienceRoom = null;
  /**
   *
    * @type {((x: number, z: number, radius?: number) => boolean)|null}
   */
  #isBlocked = null;
  /**
   *
    * @type {(() => void)|null}
   */
  #prepareGameOver = null;
  /**
   *
    * @type {TerraceRoyalActions|null}
   */
  #actions = null;
  /**
   *
    * @type {{update: (deltaTime: number) => void, destroy?: () => void}}
   */
  #behavior = null;
  /**
   *
    * @type {typeof AbstractRoyal & {kind: string, modelUrl: string}}
   */
  #RoyalType;
  /**
   *
    * @type {new (onThroneChange: (atThrone: boolean) => void) => {update: (deltaTime: number) => void, destroy?: () => void}}
   */
  #BehaviorType;
  /**
   *
    * @type {(error: Error) => void}
   */
  #onRuntimeError;
  /**
   *
    * @type {boolean}
   */
  #updateFailed = false;
  /**
   *
    * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition, runtime: import("src/game/objects/ObjectTypes.js").MapObjectRuntime, modelUrl: string, RoyalType: typeof AbstractRoyal & {kind: string, modelUrl: string}, BehaviorType: new (onThroneChange: (atThrone: boolean) => void) => {update: (deltaTime: number) => void, destroy?: () => void}}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectRuntime} options.runtime
   * @param {string} options.modelUrl
   * @param {typeof AbstractRoyal & {kind: string, modelUrl: string}} options.RoyalType
   * @param {new (onThroneChange: (atThrone: boolean) => void) => {update: (deltaTime: number) => void, destroy?: () => void}} options.BehaviorType
   */
  constructor({
    pc,
    app,
    modelLibrary,
    definition,
    runtime,
    modelUrl,
    RoyalType,
    BehaviorType,
  }) {
    this.#definition = definition;
    this.#onRuntimeError = runtime.onRuntimeError;
    this.#RoyalType = RoyalType;
    this.#BehaviorType = BehaviorType;
    this.#entity = new pc.Entity(`${definition.id} royal`);
    this.#entity.tags.add("map-object", definition.id, this.constructor.name);
    this.#audienceActor = new SeatedRoyal({
      pc,
      app,
      modelLibrary,
      modelUrl,
    });
    this.#entity.addChild(this.#audienceActor.entity);
    this.#updateHandle = app.on("update", this.#update);
    const castle = runtime.objects
      .getAll("castle")
      .at(definition.castleIndex ?? 0);
    castle?.attachRoyal(this);
  }

  get entity() {
    return this.#entity;
  }

  get definition() {
    return this.#definition;
  }

  /**
   *
    * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() {
    return [this.#entity];
  }

  get audienceActor() {
    return this.#audienceActor;
  }

  /**
   *
   * @param {{servant: import("../servant/Servant.js").Servant, audienceRoom: import("../castle/CastleAudienceRoom.js").CastleAudienceRoom, isBlocked: (x: number, z: number, radius?: number) => boolean, prepareGameOver: () => void}} options
   * @param {import("../servant/Servant.js").Servant} options.servant
   * @param {import("../castle/CastleAudienceRoom.js").CastleAudienceRoom} options.audienceRoom
   * @param {(x: number, z: number, radius?: number) => boolean} options.isBlocked
   * @param {() => void} options.prepareGameOver
   */
  connectToCastle({
    servant,
    audienceRoom,
    isBlocked,
    prepareGameOver,
    ...activityOptions
  }) {
    this.#audienceRoom = audienceRoom;
    this.#isBlocked = isBlocked;
    this.#prepareGameOver = prepareGameOver;
    this.#activity = new CastleTerraceActivity({
      ...activityOptions,
      royal: this,
      servant,
    });
    this.#entity.addChild(this.#activity.entity);
    return this.#activity;
  }

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, onRoyalAtThroneChange: (atThrone: boolean) => void, stage: import("playcanvas").Entity}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {(atThrone: boolean) => void} options.onRoyalAtThroneChange
   * @param {import("playcanvas").Entity} options.stage
   */
  createTerraceParticipant({ pc, modelLibrary, onRoyalAtThroneChange, stage }) {
    this.#behavior = new this.#BehaviorType(onRoyalAtThroneChange);
    this.#actions = new TerraceRoyalActions({
      RoyalType: this.#RoyalType,
      pc,
      modelLibrary,
      performanceSeed: this.#definition.seed ?? 0,
      stage,
    });
    return {
      kind: this.#RoyalType.kind,
      behavior: this.#behavior,
      actions: this.#actions,
    };
  }

  /**
   *
   * @param {() => {x: number, y: number, z: number}} getCameraPosition
   */
  beginGameOver(getCameraPosition) {
    this.#prepareGameOver?.();
    return (
      this.#audienceRoom?.beginGameOver(getCameraPosition, this.#isBlocked) ??
      null
    );
  }

  startGameOverPerformance() {
    this.#audienceRoom?.startGameOverPerformance();
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#actions?.destroy();
    this.#actions = null;
    this.#activity?.destroy();
    this.#activity = null;
    this.#behavior = null;
    this.#audienceActor?.destroy();
    this.#audienceActor = null;
    this.#entity?.destroy();
    this.#entity = null;
    this.#audienceRoom = null;
    this.#isBlocked = null;
    this.#prepareGameOver = null;
    this.#onRuntimeError = null;
  }

  /**
   *
   * @param {number} deltaTime
    * @type {boolean}
   */
  #update = (deltaTime) => {
    if (this.#updateFailed) {
      return;
    }
    try {
      this.#activity?.update(deltaTime);
      this.#audienceActor?.update(deltaTime);
    } catch (error) {
      this.#updateFailed = true;
      this.#activity?.stop();
      if (this.#onRuntimeError) {
        this.#onRuntimeError(error);
        return;
      }
      throw error;
    }
  };
}
