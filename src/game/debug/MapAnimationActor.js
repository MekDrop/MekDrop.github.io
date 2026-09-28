import { GRASS_SURFACE_LIFT } from "../config/terrain.js";
import { HERO_ANIMATION } from "../enum/HeroAnimation.js";
import { ROYAL_ANIMATION } from "../enum/RoyalAnimation.js";
import {
  AnimationActorObjectNotSupportedError,
  AnimationActorVariantNotSupportedError,
} from "../errors/debug/index.js";
import { SeatedRoyal } from "../objects/castle/SeatedRoyal.js";
import { Hero } from "../objects/hero/Hero.js";
import { AxeTool, ShovelTool } from "../objects/hero/tools/index.js";

const ROYAL_VARIANTS = new Map(
  ["king", "queen", "princess"].map(/**
   *
   * @param {string} variant
   * @param {number} index
   */
  (variant, index) => [
    variant,
    SeatedRoyal.modelUrls[index],
  ]),
);
const AXE_ANIMATIONS = new Set([
  HERO_ANIMATION.SUMMON_AXE,
  HERO_ANIMATION.DISMISS_AXE,
  HERO_ANIMATION.CHOP_LOW,
  HERO_ANIMATION.CHOP_MIDDLE,
  HERO_ANIMATION.CHOP_HIGH,
]);

/**
 * A map-positioned model playing one animation clip in a loop.
 */
export class MapAnimationActor {
  /**
   *
   * @type {pc.Entity}
   */
  #entity;
  /**
   *
   * @type {pc.Entity}
   */
  #model;
  /**
   *
   * @type {null}
   */
  #ownedObject = null;
  /**
   *
   * @type {null}
   */
  #tool = null;
  /**
   *
   * @type {null}
   */
  #morph = null;
  /**
   *
   * @type {Array}
   */
  #morphInstances = [];
  /**
   *
   * @type {pc.EventHandle|null}
   */
  #updateHandle = null;
  /**
   *
   * @type {number}
   */
  #elapsed = 0;

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, modelLibrary: GameModelLibrary, definition: import("src/game/GameContracts.js").GameObjectDefinition}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {GameModelLibrary} options.modelLibrary
   * @param {import("src/game/GameContracts.js").GameObjectDefinition} options.definition
   */
  constructor({ pc, app, modelLibrary, definition }) {
    const {
      id,
      object,
      animation,
      position,
      rotation = { x: 0, y: 45, z: 0 },
      scale = 0.65,
      morph = null,
    } = definition;
    /**
     *
     * @type {pc.Entity}
     */
    this.#entity = new pc.Entity(`${id} animation actor`);
    this.#entity.setLocalPosition(
      position.x,
      position.y ?? GRASS_SURFACE_LIFT,
      position.z,
    );
    /**
     *
     * @type {pc.Entity}
     */
    this.#model = this.#createModel({
      pc,
      app,
      modelLibrary,
      definition,
    });
    this.#model.name = `${id} animated model`;
    this.#model.tags.add("map-animation-actor", id, object, animation);
    this.#model.setLocalScale(scale, scale, scale);
    this.#model.setLocalEulerAngles(rotation.x, rotation.y, rotation.z);
    this.#entity.addChild(this.#model);

    if (object === Hero.name) {
      this.#configureHero({ modelLibrary, animation, morph });
    } else if (animation === ROYAL_ANIMATION.CRY) {
      this.#ownedObject.beginCrying();
    } else {
      this.#model.anim.baseLayer.play(animation);
    }

    if (this.#morphInstances.length) {
      /**
       *
       * @type {pc.EventHandle}
       */
      this.#updateHandle = app.on("update", this.#update);
    }
  }

  get entity() {
    return this.#entity;
  }

  /**
   *
   * @returns {Array}
   */
  get visualRoots() {
    return [this.#entity];
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#tool?.destroy();
    this.#tool = null;
    this.#ownedObject?.destroy();
    this.#ownedObject = null;
    this.#entity.destroy();
    this.#entity = null;
    this.#model = null;
    this.#morphInstances = [];
  }

  /**
   *
   * @param {{pc: typeof pc, app: pc.Application, modelLibrary: GameModelLibrary, definition: import("src/game/GameContracts.js").GameObjectDefinition}} options
   * @param {typeof pc} options.pc
   * @param {pc.Application} options.app
   * @param {GameModelLibrary} options.modelLibrary
   * @param {import("src/game/GameContracts.js").GameObjectDefinition} options.definition
   */
  #createModel({ pc, app, modelLibrary, definition }) {
    if (definition.object === Hero.name) {
      return modelLibrary.instantiate(Hero.modelUrl);
    }
    if (definition.object !== SeatedRoyal.name) {
      throw new AnimationActorObjectNotSupportedError({
        object: definition.object,
      });
    }
    const modelUrl = ROYAL_VARIANTS.get(definition.variant);
    if (!modelUrl) {
      throw new AnimationActorVariantNotSupportedError({
        object: definition.object,
        variant: definition.variant,
      });
    }
    this.#ownedObject = new SeatedRoyal({
      pc,
      app,
      modelLibrary,
      modelUrl,
    });
    return this.#ownedObject.entity;
  }

  /**
   *
   * @param {{modelLibrary: GameModelLibrary, animation: string, morph: (value: number) => void}} options
   * @param {GameModelLibrary} options.modelLibrary
   * @param {string} options.animation
   * @param {(value: number) => void} options.morph
   */
  #configureHero({ modelLibrary, animation, morph }) {
    const tracks = modelLibrary.getAnimationTracks(Hero.modelUrl, [animation]);
    this.#model.addComponent("anim", { activate: true });
    this.#model.anim.addAnimationState(animation, tracks.get(animation), 1, true);
    this.#model.anim.baseLayer.play(animation);
    this.#morph = morph;
    if (morph) {
      this.#morphInstances = this.#model
        .findComponents("render")
        .flatMap(/**
         *
         * @param {pc.RenderComponent} render
         */
        (render) => render.meshInstances)
        .map(/**
         *
         * @param {pc.Mesh} mesh
         */
        (mesh) => mesh.morphInstance)
        .filter(/**
         *
         * @param {pc.Entity|pc.MeshInstance} instance
         */
        (instance) =>
          instance?.morph.targets.some(/**
           *
           * @param {EventTarget|pc.Entity} target
           */
          (target) => target.name === morph),
        );
    }
    if (animation === HERO_ANIMATION.FILL_HOLE) {
      this.#tool = new ShovelTool({ modelLibrary });
    } else if (AXE_ANIMATIONS.has(animation)) {
      this.#tool = new AxeTool({ modelLibrary });
    }
    if (this.#tool) {
      this.#tool.mount(this.#model.findByName("Right arm"));
      this.#tool.visible = true;
    }
  }

  /**
   *
   * @param {number} deltaTime
   * @type {(deltaTime: number) => void}
   */
  #update = (deltaTime) => {
    this.#elapsed += deltaTime;
    const expression = Math.min(
      1,
      Math.max(0, 0.5 - Math.cos((this.#elapsed * Math.PI) / 2) * 0.7),
    );
    for (const instance of this.#morphInstances) {
      instance.setWeight(this.#morph, expression);
    }
  };
}
