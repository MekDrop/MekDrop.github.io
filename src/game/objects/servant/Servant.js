import servantModelUrl from "../../models/castle/leisure/servant.glb?url";
import { TerraceActor } from "../castle/TerraceActor.js";
import { TerraceServantBehavior } from "../castle/TerraceServantBehavior.js";
import { TerraceServiceActions } from "../castle/TerraceServiceActions.js";

export class Servant {
  static get modelUrls() {
    return [servantModelUrl, ...TerraceServiceActions.modelUrls];
  }

  #definition;
  #entity;
  #behavior = null;
  #serviceActions = null;
  #inspector = null;

  constructor({ pc, definition, runtime }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} servant`);
    this.#entity.tags.add("map-object", definition.id, this.constructor.name);
    const castle = runtime.objects
      .getAll("castle")
      .at(definition.castleIndex ?? 0);
    castle?.attachServant(this);
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

  createTerraceParticipant({ pc, modelLibrary, layout, scale, kind, royal }) {
    this.#entity.setLocalPosition(layout.x, layout.y, layout.z);
    this.#entity.setLocalEulerAngles(0, layout.yaw, 0);
    const stage = new pc.Entity("Servant terrace stage");
    stage.setLocalScale(scale, scale, scale);
    this.#entity.addChild(stage);
    this.#behavior = kind === "king" ? null : new TerraceServantBehavior();
    this.#serviceActions =
      kind === "king"
        ? null
        : new TerraceServiceActions({
            pc,
            modelLibrary,
            stage,
            kind,
            royal,
          });
    this.#inspector = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: servantModelUrl,
      kind: "servant",
    });
    this.#entity.addChild(this.#inspector.entity);
    return {
      behavior: this.#behavior,
      serviceActions: this.#serviceActions,
      inspector: this.#inspector,
    };
  }

  destroy() {
    this.#serviceActions?.destroy();
    this.#serviceActions = null;
    this.#inspector?.destroy();
    this.#inspector = null;
    this.#behavior = null;
    this.#entity?.destroy();
    this.#entity = null;
  }
}
