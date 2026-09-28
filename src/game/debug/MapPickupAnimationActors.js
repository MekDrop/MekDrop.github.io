import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { pickupActionForCategory } from "../config/hero-pickup-actions.js";
import { PickupSequenceItemNotFoundError } from "../errors/debug/index.js";
import { Hero } from "../objects/hero/Hero.js";
import groundCoverFragmentShader from "../objects/ground-cover/GroundCover.frag?raw";
import groundCoverHeldVertexShader from "../objects/ground-cover/GroundCoverHeld.vert?raw";
import { KnifeTool } from "../objects/hero/tools/index.js";
import { GroundCoverHeldItem } from "../objects/ground-cover/index.js";

const HERO_ACTOR_SCALE = 0.65;
const PICKUP_LOOP_PAUSE = 0.32;

/**
 *
 * @param {pc.Entity} root
 * @param {string} name
 */
function findChildByName(root, name) {
  const pending = [root];
  while (pending.length) {
    const entity = pending.pop();
    if (entity.name === name) {
      return entity;
    }
    pending.push(...entity.children);
  }
  return null;
}

/**
 *
 * @param {import("src/game/GameContracts.js").GameObjectDefinition} definition
 */
function heldItemScale(definition) {
  return definition.category === "flower"
    ? {
        x: definition.horizontalScale,
        y: definition.verticalScale,
        z: definition.horizontalScale,
      }
    : definition.scale;
}

/**
 *
 * @param {string} category
 */
function heldMaterialSettings(category) {
  return category === "flower"
    ? { bendHeight: 0.14, colorBoost: [1.08, 1.04, 1.08] }
    : { bendHeight: 0.12, colorBoost: [1, 1, 1] };
}

/**
 *
 * @param {typeof pc} pc
 * @param {string} category
 */
function createHeldMaterial(pc, category) {
  const settings = heldMaterialSettings(category);
  const material = new pc.ShaderMaterial({
    uniqueName: `animation-actor-held-ground-cover-${category}`,
    vertexGLSL: groundCoverHeldVertexShader,
    fragmentGLSL: groundCoverFragmentShader,
    attributes: {
      vertex_position: pc.SEMANTIC_POSITION,
      vertex_normal: pc.SEMANTIC_NORMAL,
      vertex_color: pc.SEMANTIC_COLOR,
    },
  });
  material.name = `Animation actor held ${category} ground cover`;
  material.cull = pc.CULLFACE_NONE;
  material.setParameter("uBendHeight", settings.bendHeight);
  material.setParameter("uColorBoost", settings.colorBoost);
  material.setParameter("uLightDirection", [0.42, 0.82, 0.38]);
  material.update();
  return material;
}
/**
 * Map-positioned hero pickup animation actors.
 */
export class MapPickupAnimationActors {
  /**
   *
   * @type {typeof pc}
   */
  #pc;
  /**
   *
   * @type {GameModelLibrary}
   */
  #modelLibrary;
  /**
   *
   * @type {pc.Entity}
   */
  #entity;
  /**
   *
   * @type {Map}
   */
  #heldMaterials = new Map();
  /**
   *
   * @type {Array}
   */
  #entries = [];
  /**
   *
   * @type {pc.EventHandle|null}
   */
  #updateHandle = null;

  /**
   *
   * @param {{pc: typeof pc, modelLibrary: GameModelLibrary, app: pc.Application, definitions: Array}} options
   * @param {typeof pc} options.pc
   * @param {GameModelLibrary} options.modelLibrary
   * @param {pc.Application} options.app
   * @param {Array} options.definitions
   * @param {Array<{definition: {id: string}, variantDefinition: object}>} options.items
   */
  constructor({ pc, modelLibrary, app, definitions, items }) {
    /**
     *
     * @type {typeof pc}
     */
    this.#pc = pc;
    /**
     *
     * @type {GameModelLibrary}
     */
    this.#modelLibrary = modelLibrary;
    /**
     *
     * @type {pc.Entity}
     */
    this.#entity = new pc.Entity("Map pickup animation actors");
    const tracks = modelLibrary.getAnimationTracks(
      Hero.modelUrl,
      [...new Set(definitions.map(/**
       *
       * @param {{animation: string}} options
       * @param {string} options.animation
       */
      ({ animation }) => animation))],
    );

    for (const [index, actor] of definitions.entries()) {
      const {
        id,
        animation,
        sequence,
        position,
        rotation = { x: 0, y: 45, z: 0 },
        scale = HERO_ACTOR_SCALE,
      } = actor;
      const sourceItem = items.find(
        /**
         *
         * @param {{definition: import("src/game/GameContracts.js").GameObjectDefinition}} options
         * @param {import("src/game/GameContracts.js").GameObjectDefinition} options.definition
         */
        ({ definition }) => definition.id === sequence.item,
      );
      if (!sourceItem) {
        throw new PickupSequenceItemNotFoundError({
          actorId: id,
          itemId: sequence.item,
        });
      }
      const definition = sourceItem.variantDefinition;
      if (!this.#heldMaterials.has(definition.category)) {
        this.#heldMaterials.set(
          definition.category,
          createHeldMaterial(pc, definition.category),
        );
      }
      const pickupAction = {
        ...pickupActionForCategory(definition.category),
        animation,
      };
      const anchor = new pc.Entity(`${id} pickup actor`);
      anchor.setLocalPosition(
        position.x,
        position.y ?? GRASS_SURFACE_LIFT,
        position.z,
      );
      this.#entity.addChild(anchor);

      const model = modelLibrary.instantiate(Hero.modelUrl);
      model.name = `${id} pickup animated model`;
      model.tags.add("map-animation-actor", id, Hero.name, animation);
      model.setLocalScale(scale, scale, scale);
      model.setLocalEulerAngles(rotation.x, rotation.y, rotation.z);
      anchor.addChild(model);
      model.addComponent("anim", { activate: true });
      model.anim.addAnimationState(
        pickupAction.animation,
        tracks.get(pickupAction.animation),
        1,
        false,
      );
      model.anim.baseLayer.play(pickupAction.animation);
      model.anim.speed = 0;

      let tool = null;
      if (pickupAction.requiresTool) {
        tool = new KnifeTool({ modelLibrary });
        tool.mount(findChildByName(model, "Right arm"));
        tool.visible = true;
      }

      this.#entries.push({
        name: id,
        anchor,
        model,
        sourceItem,
        definition,
        pickupAction,
        tool,
        elapsed: index * 0.11,
        heldItem: null,
      });
    }

    /**
     *
     * @type {pc.EventHandle}
     */
    this.#updateHandle = app.on("update", this.#update);
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @returns {Array}
   */
  get visualRoots() {
    return this.#entity.children;
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    for (const entry of this.#entries) {
      entry.heldItem?.destroy();
      entry.tool?.destroy();
    }
    this.#entries = [];
    for (const material of this.#heldMaterials.values()) {
      material.destroy();
    }
    this.#heldMaterials.clear();
    this.#entity.destroy();
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameCanvasPluginEntry} entry
   */
  #createHeldItem(entry) {
    return new GroundCoverHeldItem({
      pc: this.#pc,
      modelLibrary: this.#modelLibrary,
      modelUrl: entry.definition.modelUrl,
      name: entry.name,
      scale: heldItemScale(entry.definition),
      material:
        entry.definition.category === "flower"
          ? this.#heldMaterials.get("flower")
          : null,
      gripPoint: entry.definition.gripPoint,
      pickupTilt: entry.definition.category === "flower" ? -68 : 25,
      pickupPitch: entry.definition.category === "mushroom" ? 60 : 0,
      pickupYaw: entry.definition.category === "mushroom" ? 20 : 0,
      keepCapUpright: entry.definition.category === "mushroom",
    });
  }

  /**
   *
   * @param {number} deltaTime
   * @type {(deltaTime: number) => void}
   */
  #update = (deltaTime) => {
    for (const entry of this.#entries) {
      const loopDuration = entry.pickupAction.duration + PICKUP_LOOP_PAUSE;
      const previousElapsed = entry.elapsed;
      entry.elapsed = (entry.elapsed + deltaTime) % loopDuration;
      if (entry.elapsed < previousElapsed) {
        entry.heldItem?.destroy();
        entry.heldItem = null;
        entry.sourceItem.reset();
        entry.model.anim.baseLayer.play(entry.pickupAction.animation);
      }
      const animationTime = Math.min(entry.elapsed, entry.pickupAction.duration);
      entry.model.anim.baseLayer.activeStateCurrentTime = animationTime;
      if (animationTime < entry.pickupAction.impactTime) {
        entry.sourceItem.reset();
        entry.sourceItem.advance(deltaTime);
      } else {
        entry.sourceItem.hide();
      }
      if (
        animationTime >= entry.pickupAction.impactTime &&
        animationTime < entry.pickupAction.heldItemHideTime
      ) {
        if (!entry.heldItem) {
          entry.heldItem = this.#createHeldItem(entry);
          const gloveName = entry.pickupAction.heldItemAttachment === "left"
            ? "Left white glove"
            : "Right white glove";
          entry.heldItem.mount(
            entry.anchor,
            findChildByName(entry.model, gloveName),
          );
        }
        entry.heldItem.follow(deltaTime);
      } else if (entry.heldItem) {
        entry.heldItem.destroy();
        entry.heldItem = null;
      }
    }
  };
}
