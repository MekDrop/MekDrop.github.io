import { DynamicTextTexture } from "../../textures/text/DynamicTextTexture.js";
import signModelUrl from "../../models/scenery/arrow-signpost.glb?url";

/**
 * An authored wooden direction sign with an instance-specific inscription.
 */
export class WoodenSign {
  /**
   *
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("playcanvas").Entity}
   */
  #collisionGraph;
  /**
   *
   * @type {import("src/game/objects/ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   *
   * @type {DynamicTextTexture}
   */
  #texture;
  /**
   *
   * @type {import("playcanvas").Material}
   */
  #material;

  /**
   *
   * @returns {string}
   */
  static get modelUrl() {
    return signModelUrl;
  }

  /**
   *
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: string, definition: import("src/game/objects/ObjectTypes.js").MapObjectDefinition}} options
   * @param {typeof import("playcanvas")} options.pc
   * @param {import("playcanvas").Application} options.app
   * @param {string} options.modelLibrary
   * @param {import("src/game/objects/ObjectTypes.js").MapObjectDefinition} options.definition
   */
  constructor({ pc, app, modelLibrary, definition }) {
    const {
      id,
      text,
      position,
      rotation = {
        x: 0,
        y: 45,
        z: 0,
      },
      scale = 1,
    } = definition;
    this.#definition = definition;
    this.#entity = new pc.Entity(`${id} wooden sign`);
    this.#entity.tags.add("map-object", id, this.constructor.name);
    const angles = typeof rotation === "number"
      ? {
        x: 0,
        y: rotation,
        z: 0,
      }
      : rotation;
    this.#entity.setLocalEulerAngles(angles.x ?? 0, angles.y ?? 45, angles.z ?? 0);
    this.#entity.setLocalPosition(position.x, position.y, position.z);
    this.#visual = modelLibrary.instantiate(signModelUrl);
    this.#visual.setLocalScale(scale, scale, scale);
    this.#entity.addChild(this.#visual);

    // Keep the physics root unscaled; bake the authored wood geometry into its mesh shape.
    this.#collisionGraph = modelLibrary.instantiate(signModelUrl);
    this.#collisionGraph.setLocalScale(scale, scale, scale);
    const collisionModel = new pc.Model();
    collisionModel.graph = this.#collisionGraph;
    collisionModel.meshInstances = this.#collisionGraph.findComponents("render").flatMap(WoodenSign.#flatMapRender);
    this.#entity.addComponent("collision", {
      type: "mesh",
      model: collisionModel,
    });
    this.#entity.addComponent("rigidbody", {
      type: "static",
      friction: 0.6,
      restitution: 0,
    });

    this.#texture = DynamicTextTexture.inscription(pc, app.graphicsDevice, text);
    this.#material = new pc.StandardMaterial();
    this.#material.name = `${text} painted inscription`;
    this.#material.diffuse = new pc.Color(1, 1, 1);
    this.#material.diffuseMap = this.#texture.texture;
    this.#material.opacityMap = this.#texture.texture;
    this.#material.opacityMapChannel = "a";
    this.#material.blendType = pc.BLEND_NORMAL;
    this.#material.depthWrite = false;
    this.#material.useMetalness = true;
    this.#material.metalness = 0;
    this.#material.gloss = 0;
    this.#material.update();
    for (const render of this.#visual.findByName("Sign inscription").findComponents("render")) {
      for (const mesh of render.meshInstances) {
        mesh.material = this.#material;
        mesh.castShadow = false;
      }
    }
  }

  /**
   * Repaint an existing inscription without allocating another material or texture.
   * @param {string} value
   */
  set text(value) {
    this.#texture.text = value;
    this.#definition.text = value;
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

  destroy() {
    this.#entity.destroy();
    this.#collisionGraph.destroy();
    this.#material.destroy();
    this.#texture.destroy();
  }

  /**
   * @param {import("playcanvas").RenderComponent} render
   */
  static #flatMapRender(render) {
    return render.entity.name === "Sign inscription" ? [] : render.meshInstances;
  }
}
