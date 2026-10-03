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
    * @type {string}
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
      rotation = { x: 0, y: 45, z: 0 },
      scale = 1,
    } = definition;
    this.#definition = definition;
    this.#entity = new pc.Entity(`${id} wooden sign`);
    this.#entity.tags.add("map-object", id, this.constructor.name);
    const angles = typeof rotation === "number"
      ? { x: 0, y: rotation, z: 0 }
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
    collisionModel.meshInstances = this.#collisionGraph.findComponents("render").flatMap(
      /**
       * @param {import("playcanvas").RenderComponent} render
       */
      (render) => render.entity.name === "Sign inscription" ? [] : render.meshInstances,
    );
    this.#entity.addComponent("collision", { type: "mesh", model: collisionModel });
    this.#entity.addComponent("rigidbody", {
      type: "static",
      friction: 0.6,
      restitution: 0,
    });

    const canvas = WoodenSign.#createInscription(text);
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: `${text} sign lettering`,
      width: canvas.width,
      height: canvas.height,
      format: pc.PIXELFORMAT_RGBA8,
      srgb: true,
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
      anisotropy: 4,
    });
    this.#texture.setSource(canvas);
    this.#material = new pc.StandardMaterial();
    this.#material.name = `${text} painted inscription`;
    this.#material.diffuse = new pc.Color(1, 1, 1);
    this.#material.diffuseMap = this.#texture;
    this.#material.opacityMap = this.#texture;
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
   * @param {string} text
   * @returns {HTMLCanvasElement}
   */
  static #createInscription(text) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    const words = text.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ");
    const lines = words.length > 2
      ? [words.slice(0, -1).join(" "), words.at(-1)]
      : [words.join(" ")];
    let fontSize = lines.length > 1 ? 90 : 160;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    do {
      context.font = `bold ${fontSize}px "Palatino Linotype", Georgia, serif`;
      if (lines.every(/**
       *
       * @param {Array<number>} line
       */
      (line) => {
        const metrics = context.measureText(line);
        const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
        return metrics.width <= 494 && height <= (lines.length > 1 ? 67 : 142);
      })) {
        break;
      }
      fontSize -= 2;
    } while (fontSize > 24);
    context.fillStyle = "#efd8a2";
    for (const [index, line] of lines.entries()) {
      const metrics = context.measureText(line);
      let x = (canvas.width - metrics.width) / 2;
      const baseline = 80 + (index - (lines.length - 1) / 2) * 76
        + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      context.textAlign = "left";
      for (const [letterIndex, letter] of [...line].entries()) {
        const variation = Math.sin(letterIndex * 2.3 + index);
        context.save();
        context.translate(x, baseline + variation * 1.5);
        context.rotate(variation * 0.025);
        context.fillText(letter, 0, 0);
        context.restore();
        x += context.measureText(letter).width;
      }
    }
    return canvas;
  }

  /**
   * Repaint an existing inscription without allocating another material or texture.
   * @param {string} value
   */
  set text(value) {
    this.#texture.setSource(WoodenSign.#createInscription(value));
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
}
