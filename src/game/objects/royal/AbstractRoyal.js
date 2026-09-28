import { CastleTerraceActivity } from "../castle/CastleTerraceActivity.js";
import { SeatedRoyal } from "../castle/SeatedRoyal.js";
import { TerraceRoyalActions } from "../castle/TerraceRoyalActions.js";

/**
 * Shared map-object lifecycle for a royal resident.
 *
 * @abstract
 */
export class AbstractRoyal {
  #definition;
  #entity;
  #audienceActor;
  #activity = null;
  #audienceRoom = null;
  #isBlocked = null;
  #prepareGameOver = null;
  #actions = null;
  #behavior = null;
  #RoyalType;
  #BehaviorType;
  #onRuntimeError;
  #updateFailed = false;
  #updateHandle = null;

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

  get visualRoots() {
    return [this.#entity];
  }

  get audienceActor() {
    return this.#audienceActor;
  }

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
