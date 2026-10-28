import { TerrainInstanceRenderer } from "../../rendering/terrain/TerrainInstanceRenderer.js";
import { BridgeRailingKit } from "./BridgeRailingKit.js";

const DECK_COLLISION_CLEARANCE = 0.035;

/**
 * An original sandstone deck row released into Ammo, with its timber rails.
 */
export class OverpassDeckFragment {
  /**
   * @type {import("playcanvas").Entity}
   */
  entity;
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {TerrainInstanceRenderer}
   */
  #deck;
  /**
   * @type {import("playcanvas").VertexBuffer[]}
   */
  #buffers;
  /**
   * @type {number}
   */
  #age = 0;
  /**
   * @type {Map<import("playcanvas").Material,import("playcanvas").Material>}
   */
  #fades = new Map();

  /**
   * @param {import("../ObjectTypes.js").MapObjectOptions & {station:number}} options
   */
  constructor({ pc, app, modelLibrary, definition, runtime, station }) {
    this.#pc = pc;
    const layout = definition.layout;
    const { crossing } = layout;
    const thickness = layout.deckThickness ?? 0.24;
    this.entity = new pc.Entity(`Falling sandstone crossing ${station}`);
    this.entity.tags.add("hero-moving-support");
    this.entity.setPosition(crossing.col + (crossing.width - 1) / 2 - (runtime.mapData.cols - 1) / 2,
      layout.deckElevation - thickness / 2, station - (runtime.mapData.rows - 1) / 2);
    app.root.addChild(this.entity);
    this.#deck = new TerrainInstanceRenderer({
      pc,
      app,
      root: this.entity,
      materials: runtime.materials,
    });
    const commands = definition.deckCommands ?? [];
    const surface = commands.find(OverpassDeckFragment.#isSurface);
    const sides = commands.find(OverpassDeckFragment.#isSides);
    const resolve = runtime.resolveMaterial ?? OverpassDeckFragment.#identity;
    this.#deck.addBoxMatrix(resolve(surface?.args[0] ?? "path"), resolve(sides?.args[1] ?? "path"),
      0, 0, 0, 0, crossing.width, thickness, 1, "full", resolve(sides?.args[10] ?? "path"));
    this.#deck.build();
    const railings = new BridgeRailingKit({
      pc,
      modelLibrary,
      root: this.entity,
    });
    this.#addRailing(railings, definition.railingMaterial ?? "wood", crossing.width, thickness, -1);
    this.#addRailing(railings, definition.railingMaterial ?? "wood", crossing.width, thickness, 1);
    this.#buffers = railings.build();
    this.entity.addComponent("collision", { type: "compound" });
    const slab = new pc.Entity("Sandstone crossing support");
    slab.tags.add("hero-support-surface");
    // The intact slab exactly fills its terrain opening. Once released, even
    // a small tilt puts its convex corners into the retained stair lips and
    // adjacent rows. Fracture clearance lets Ammo drop it through that opening
    // while preserving the original artwork and unchanged top support height.
    slab.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(crossing.width / 2 - DECK_COLLISION_CLEARANCE,
        thickness / 2, 0.5 - DECK_COLLISION_CLEARANCE),
    });
    this.entity.addChild(slab);
    this.entity.addComponent("rigidbody", {
      type: "dynamic",
      mass: 24,
      friction: 0.7,
      restitution: 0,
      // Terrain deliberately has zero friction for character movement. Stone
      // rows therefore need their own native energy dissipation to stop
      // skating and rocking after impact on that otherwise frictionless mesh.
      linearDamping: 0.6,
      angularDamping: 0.85,
      group: pc.BODYGROUP_USER_1,
      mask: pc.BODYMASK_STATIC | pc.BODYGROUP_DYNAMIC | pc.BODYGROUP_USER_1,
    });
    this.entity.rigidbody.applyTorqueImpulse(0.35 * (station % 2 ? -1 : 1), 0.02, 0.08);
  }

  /**
   * @param {BridgeRailingKit} railings
   * @param {string} material
   * @param {number} width
   * @param {number} thickness
   * @param {number} side
   */
  #addRailing(railings, material, width, thickness, side) {
    railings.addRailing({
      position: new this.#pc.Vec3(side * (width / 2 - 0.07), thickness / 2, -0.5),
      direction: new this.#pc.Vec3(0, 0, 1),
      length: 1,
      material,
      endPost: false,
    });
  }

  /**
   * @param {import("../ObjectTypes.js").RenderCommand} command
   */
  static #isSurface(command) {
    return command.args[9] === "surfaceOnly";
  }

  /**
   * @param {import("../ObjectTypes.js").RenderCommand} command
   */
  static #isSides(command) {
    return command.args[9] === "bridgeVerticalSidesOnly";
  }

  /**
   * @param {string} value
   */
  static #identity(value) {
    return value;
  }

  /**
   * @returns {boolean}
   */
  get expired() {
    return this.#age >= 5;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    this.#age += deltaTime;
    if (this.#age < 3.5) {
      return;
    }
    for (const render of this.entity.findComponents("render")) {
      for (const instance of render.meshInstances) {
        if (!this.#fades.has(instance.material)) {
          const fade = instance.material.clone();
          fade.blendType = this.#pc.BLEND_NORMAL;
          fade.depthWrite = false;
          this.#fades.set(instance.material, fade);
          this.#fades.set(fade, fade);
        }
        instance.material = this.#fades.get(instance.material);
      }
    }
    for (const fade of new Set(this.#fades.values())) {
      fade.opacity = Math.max(0, (5 - this.#age) / 1.5);
      fade.update();
    }
  }

  destroy() {
    this.#deck.destroy();
    this.entity.destroy();
    for (const buffer of this.#buffers) {
      buffer.destroy();
    }
    for (const fade of new Set(this.#fades.values())) {
      fade.destroy();
    }
    this.#fades.clear();
  }
}
