import servantModelUrl from "../../models/castle/leisure/servant.glb?url";
import { TerraceActor } from "../castle/TerraceActor.js";
import { TerraceServantBehavior } from "../castle/TerraceServantBehavior.js";
import { TerraceServiceActions } from "../castle/TerraceServiceActions.js";

export class Servant {
  /**
   *
    * @returns {Array<string>}
   */
  static get modelUrls() {
    return [servantModelUrl, ...TerraceServiceActions.modelUrls];
  }

  /**
   *
    * @type {TerraceServantBehavior|null}
   */
  #definition;
  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   *
    * @type {import("../castle/TerraceServantBehavior.js").TerraceServantBehavior|null}
   */
  #behavior = null;
  /**
   *
    * @type {TerraceServiceActions|null}
   */
  #serviceActions = null;
  /**
   *
    * @type {TerraceActor|null}
   */
  #inspector = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition, runtime: import("src/game/objects/ObjectTypes.js").MapObjectRuntime}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectRuntime} options.runtime
   */
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

  /**
   *
    * @returns {Array<import("playcanvas").Entity>}
   */
  get visualRoots() {
    return [this.#entity];
  }

  /**
   *
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("src/game/models/GameModelLibrary.js").GameModelLibrary, layout: {x: number, y: number, z: number, yaw: number}, scale: number, kind: string, royal: import("../royal/AbstractRoyal.js").AbstractRoyal}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("src/game/models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {{x: number, y: number, z: number, yaw: number}} options.layout
   * @param {number} options.scale
   * @param {string} options.kind
   * @param {import("../royal/AbstractRoyal.js").AbstractRoyal} options.royal
   */
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
