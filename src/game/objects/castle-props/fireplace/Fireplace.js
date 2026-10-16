import modelUrl from "../../../models/castle/props/kitchen-fireplace.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";
import { FireSurfaceMaterial } from "../../fire/FireSurfaceMaterial.js";
import terminalModelUrl from "../../../models/castle/props/terrace-chimney-terminal.glb?url";
import chimneyModelUrl from "../../../models/castle/props/kitchen-chimney-course.glb?url";
import { CastleMasonryMaterial } from "../../castle/CastleMasonryMaterial.js";
import { CASTLE_MATERIAL_DEFINITIONS } from "../../../generator/castle/CastleGenerationConfig.js";
import { colorFromHex } from "../../../helpers/colors.js";

/**
 * Authored fireplace placed through the map objects array.
 */
export class Fireplace extends AbstractCastleProp {
  /**
   * @type {import("playcanvas").StandardMaterial[]}
   */
  #materials = [];
  /**
   * @type {import("playcanvas").EventHandle|null}
   */
  #updateHandle = null;
  /**
   * @type {number}
   */
  #elapsed = 0;
  /**
   * @type {import("playcanvas").Entity|null}
   */
  #chimney = null;
  /**
   * @type {import("playcanvas").Mat4}
   */
  #worldToMasonry;

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, modelLibrary: import("../../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../../ObjectTypes.js").MapObjectDefinition, runtime?: import("../../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor(options) {
    super(options);

    const { pc, app, definition } = options;
    const root = this.visualRoots[0];
    // Castle masonry uses map coordinates, with only the island offset removed.
    this.#worldToMasonry = new pc.Mat4().copy(root.parent.getWorldTransform()).invert();
    const stone = CASTLE_MATERIAL_DEFINITIONS.castleStoneMid;
    const masonry = new pc.StandardMaterial();
    this.#materials.push(masonry);
    masonry.name = "Kitchen chimney castle masonry";
    masonry.diffuse = colorFromHex(pc, stone.color);
    masonry.gloss = stone.gloss;
    masonry.metalness = 0;
    masonry.useMetalness = true;
    CastleMasonryMaterial.configure(pc, masonry, this.#worldToMasonry.data);
    masonry.update();
    for (const render of root.findComponents("render")) {
      for (const instance of render.meshInstances) {
        if (instance.material.name === "Castle fireplace masonry") {
          instance.material = masonry;
          continue;
        }
        if (instance.material.name === "Chimney soot-dark stone") { continue; }
        const material = FireSurfaceMaterial.create(pc, app.graphicsDevice, instance.material, {
          position: {
            x: 0,
            y: 0.25,
            z: -0.08,
          },
          volume: {
            x: 0.74,
            y: 0.59,
            z: 0.48,
          },
          fadeIn: {
            x: 0.05,
            y: 0.06,
            z: 0.08,
          },
          fadeOut: {
            x: 0.05,
            y: 0.05,
            z: 0.08,
          },
        });
        instance.material = material;
        this.#materials.push(material);
      }
    }
    const socket = root.findByName("Chimney socket from original fireplace stone");
    for (const render of socket?.findComponents("render") ?? []) {
      for (const instance of render.meshInstances) { instance.material = masonry; }
    }
    // Keep full stone courses at their authored proportions. Only the final
    // course is shortened to meet the local roof surface exactly.
    const scale = definition.scale ?? 1;

    const top = definition.chimneyHeight ?? 1.65 * scale;
    const stoneTop = definition.chimneyMetalTerminal ? top - 0.72 : top;
    const courseHeight = 0.24 * scale;
    this.#chimney = new pc.Entity("Kitchen chimney");
    root.addChild(this.#chimney);
    for (let bottom = 1.65 * scale, index = 0; bottom < stoneTop; bottom += courseHeight, index++) {
      const course = options.modelLibrary.instantiate(chimneyModelUrl);
      course.name = `Kitchen chimney course ${index}`;
      course.setLocalPosition(0.028 * scale, bottom, -0.2073 * scale);
      course.setLocalEulerAngles(0, index % 2 * 180, 0);
      course.setLocalScale(scale, Math.min(courseHeight, stoneTop - bottom) / 0.24, scale);
      for (const render of course.findComponents("render")) {
        for (const instance of render.meshInstances) {
          if (instance.material.name !== "Chimney soot-dark stone") { instance.material = masonry; }
        }
      }
      this.#chimney.addChild(course);
    }
    if (definition.chimneyMetalTerminal) {
      const terminal = options.modelLibrary.instantiate(terminalModelUrl);
      terminal.name = "Covered metal terrace chimney";
      terminal.setLocalPosition(0.028 * scale, stoneTop, -0.2073 * scale);
      this.#chimney.addChild(terminal);
    }
    if (top > 1.65 * scale) {
      const height = top - 1.65 * scale;
      this.#chimney.addComponent("collision", {
        type: "box",
        halfExtents: new pc.Vec3(0.29 * scale, height / 2, 0.2 * scale),
        linearOffset: new pc.Vec3(0.028 * scale, 1.65 * scale + height / 2, -0.2073 * scale),
      });
      this.#chimney.addComponent("rigidbody", {
        type: "static",
        friction: 0.6,
        restitution: 0,
      });
    }
    const glow = new pc.Entity("Kitchen hearth glow");
    glow.setLocalPosition(0, 0.55 * scale, 0.24 * scale);
    glow.addComponent("light", {
      type: "omni",
      color: new pc.Color(1, 0.29, 0.045),
      range: 2.5 * scale,
      intensity: 1.4,
      castShadows: false,
    });
    root.addChild(glow);
    this.#elapsed = definition.position.x * 0.73 + definition.position.z * 1.19;
    this.#updateHandle = app.on("update",
      /**
       * @param {number} deltaTime
       */
      (deltaTime) => this.#animate(deltaTime, glow),
    );
  }

  /**
   * @param {number} deltaTime
   * @param {import("playcanvas").Entity} glow
   */
  #animate(deltaTime, glow) {
    this.#worldToMasonry.copy(this.visualRoots[0].parent.getWorldTransform()).invert();
    this.#elapsed += deltaTime;
    glow.light.intensity = 1.35 + Math.sin(this.#elapsed * 11.1) * 0.2 +
      Math.sin(this.#elapsed * 4.7) * 0.13;
  }
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return modelUrl;
  }

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [modelUrl, chimneyModelUrl, terminalModelUrl];
  }

  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets = [near, far]) {
    super.setIslandOffsets(near, far, offsets);
    this.#worldToMasonry.copy(this.visualRoots[0].parent.getWorldTransform()).invert();
    this.#chimney.rigidbody?.syncEntityToBody();
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    super.destroy();
    this.#chimney = null;
    for (const material of this.#materials) {
      material.destroy();
    }
    this.#materials = [];
  }
}
