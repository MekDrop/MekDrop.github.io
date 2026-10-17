import servantModelUrl from "../../../models/castle/leisure/servant.glb?url";
import { DynamicRenderBatch } from "../../../rendering/DynamicRenderBatch.js";
import { CHARACTER_HEIGHT } from "../../../config/character-size.js";
import { CastleResidentMotion } from "../../castle/residents/CastleResidentMotion.js";
import { TerraceActor } from "../../castle/rooms/terrace/TerraceActor.js";
import { TerraceServantBehavior } from "../../castle/rooms/terrace/TerraceServantBehavior.js";
import { TerraceServiceActions } from "../../castle/rooms/terrace/TerraceServiceActions.js";

export class Servant {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("../../ObjectTypes.js").MapObjectRuntime}
   */
  #runtime;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {DynamicRenderBatch|null}
   */
  #renderBatch = null;
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
    * @type {import("../../castle/rooms/terrace/TerraceServantBehavior.js").TerraceServantBehavior|null}
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
   * @type {import("../../castle/residents/CastleResidence.js").CastleResidence|null}
   */
  #residence = null;
  /**
   * @type {TerraceActor|null}
   */
  #resident = null;
  /**
   * @type {CastleResidentMotion|null}
   */
  #motion = null;

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition, runtime: import("src/game/objects/ObjectTypes.js").MapObjectRuntime}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectRuntime} options.runtime
   */
  constructor({ pc, app, definition, runtime }) {
    this.#pc = pc;
    this.#runtime = runtime;
    this.#app = app;
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

  onSceneReady() {
    if (!this.#app) {
      return;
    }
    this.#renderBatch ??= new DynamicRenderBatch(this.#app, this.#entity,
      this.#pc.BUFFER_STATIC, true, "characters");
  }

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../../models/GameModelLibrary.js").GameModelLibrary, residence: import("../../castle/residents/CastleResidence.js").CastleResidence}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} options.modelLibrary
   * @param {import("../../castle/residents/CastleResidence.js").CastleResidence} options.residence
   */
  bindResidence({ pc, modelLibrary, residence }) {
    this.#residence = residence;
    this.#resident = new TerraceActor({
      pc,
      modelLibrary,
      modelUrl: servantModelUrl,
      kind: "servant",
    });
    this.#resident.entity.name = "Basement servant resident";
    const scale = CHARACTER_HEIGHT / this.#resident.height;
    this.#resident.entity.setLocalScale(scale, scale, scale);
    this.#entity.addChild(this.#resident.entity);
    this.enterBasement();
    this.#resident.pose("idle", 0);
  }

  /**
   * The castle authorizes the attached servant identity.
   * @returns {boolean}
   */
  enterBasement() {
    if (!this.#residence?.canEnterBasement(this)) {
      return false;
    }
    const { layout } = this.#residence;
    const room = layout.rooms.servantBedroom;
    // Reserve the actor's full standing footprint rather than a fixed table-side point.
    let standing = null;
    const items = layout.standingObstacles;
    for (let z = room.minZ + 0.6; z <= room.maxZ - 0.6 && !standing; z += 0.25) {
      for (let x = room.maxX - 0.6; x >= room.minX + 0.6; x -= 0.25) {
        const point = layout.toWorld(x, z, room.floorY - layout.origin.y);
        /**
         * @param {{role:string,position:{x:number,z:number},scale:{x:number,z:number}}} item
         */
        const leavesStandingClearance = (item) => {
          if (Math.abs(item.position.y - room.floorY) > 0.1) {
            return true;
          }
          const local = layout.toLocal(item.position.x, item.position.z);
          const [width, depth] = {
            kitchenTable: [0.9, 0.55],
            servantBed: [0.9, 2],
            storageShelf: [0.8, 0.3],
            workDesk: [0.9, 0.55],
            bookshelf: [0.3, 1],
            royalBed: [1.2, 1.8],
            wardrobe: [0.65, 0.46],
            readingChair: [0.75, 0.735],
          }[item.role] ?? [1, 1];

          return Math.hypot(Math.max(0, Math.abs(local.x - x) - (item.footprint?.width ?? width * item.scale.x) / 2),
            Math.max(0, Math.abs(local.z - z) - (item.footprint?.depth ?? depth * item.scale.z) / 2)) >= 0.45;
        };
        if (items.every(leavesStandingClearance)) {
          standing = point;
          break;
        }
      }
    }
    if (!standing) {
      return false;
    }
    const point = standing;
    this.#entity.setLocalPosition(point.x, point.y, point.z);
    this.#entity.setLocalEulerAngles(0, layout.yaw, 0);

    return true;
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
   * @param {{x: number, z: number}} options.serviceOffset Offset from the doorway toward the terrace center.
   */
  createTerraceParticipant({ pc, modelLibrary, layout, scale, kind, royal, navigation, serviceOffset = {
    x: 0,
    z: 0,
  } }) {
    const stage = new pc.Entity("Servant terrace stage");
    stage.setLocalScale(scale, scale, scale);
    this.#entity.addChild(stage);
    const angle = layout.yaw * Math.PI / 180;
    stage.setPosition(
      layout.x + Math.cos(angle) * serviceOffset.x + Math.sin(angle) * serviceOffset.z,
      layout.y,
      layout.z - Math.sin(angle) * serviceOffset.x + Math.cos(angle) * serviceOffset.z,
    );
    stage.setEulerAngles(0, layout.yaw, 0);
    this.#motion = new CastleResidentMotion({
      actor: this.#resident,
      ...navigation,
      homeArea: navigation.layout.rooms.servantBedroom,
    });
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
          servingTray: this.#runtime.objects.getAll("mapObject").find(
            /**
             * @param {import("../../ObjectTypes.js").MapObjectLike} object
             */
            (object) => object.definition?.carrierId === this.#definition.id,
          ),
          actor: this.#resident,
          motion: this.#motion,
        });
    this.#inspector = this.#resident;

    return {
      behavior: this.#behavior,
      serviceActions: this.#serviceActions,
      inspector: this.#inspector,
      motion: this.#motion,
    };
  }

  destroy() {
    this.#renderBatch?.destroy();
    this.#renderBatch = null;
    this.#resident?.destroy();
    this.#resident = null;
    this.#residence = null;
    this.#serviceActions?.destroy();
    this.#serviceActions = null;
    this.#motion = null;
    this.#inspector = null;
    this.#behavior = null;
    this.#entity?.destroy();
    this.#entity = null;
  }
}
