import { arePositiveFiniteNumbers } from "../../helpers/types.js";
import particleUrl from "src/assets/game/effects/castle-fire-particle.png?url";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";

/**
 * Map-authored fire. Position is the box bottom center; volume is its full size.
 * One box emitter fills the footprint, with flame height and density derived from it.
 */
export class Fire {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;

  /**
   * @returns {Record<string, string>}
   */
  static get textureUrls() { return { castleFireParticle: particleUrl }; }

  /**
   * Attach normal fire in a prop's local space. Its parent owns its lifetime.
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Entity} parent
   * @param {{x: number, y: number, z: number}} position
   * @param {{x: number, y: number, z: number}} volume
   * @returns {Fire}
   */
  static attach(pc, parent, position, volume) {
    const fire = new Fire({
      pc,
      app: pc.Application.getApplication(),
      definition: {
        id: `${parent.name} fire`,
        object: Fire.name,
        position,
        volume,
      },
    });
    parent.addChild(fire.entity);

    return fire;
  }

  /**
   * @param {{pc: typeof import("playcanvas"), app: import("playcanvas").Application, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, app, definition, runtime = {} }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    const root = new pc.Entity(`${definition.id} Fire`);
    root.tags.add("map-object", definition.id, Fire.name);
    this.#islandRoots.addChild(root, definition.tile);
    const { x, y, z } = definition.position;
    root.setLocalPosition(x, y, z);
    root.setLocalEulerAngles(0, definition.rotation ?? 0, 0);
    const { x: width, y: height, z: depth } = definition.volume;
    // Reject empty or non-finite volumes without allocating a particle system.
    if (!arePositiveFiniteNumbers(width, height, depth)) { return; }
    const size = Math.min(width, depth, height * 0.18);
    const count = Math.min(2048, Math.max(16, Math.ceil(width * depth / (size * size) * 2)));
    const lifetime = 0.42;
    const requestedIntensity = definition.intensity ?? 1;
    const intensity = Number.isFinite(requestedIntensity) ? Math.max(0, requestedIntensity) : 1;
    const emitter = new pc.Entity("Rising fire particles");
    emitter.enabled = intensity > 0;
    emitter.setLocalPosition(0, size, 0);
    emitter.addComponent("particlesystem", {
      numParticles: count,
      lifetime,
      rate: lifetime / count,
      rate2: lifetime / count,
      loop: true,
      preWarm: true,
      lighting: false,
      intensity: 1.08 * intensity,
      // The engine already rotates box spawn bounds into world space. Local
      // simulation applies the model rotation again when rendering particles.
      depthWrite: false,
      noFog: true,
      localSpace: false,
      sort: pc.PARTICLESORT_OLDER_FIRST,
      blendType: pc.BLEND_NORMAL,
      emitterShape: pc.EMITTERSHAPE_BOX,
      emitterExtents: new pc.Vec3(Math.max(0, width - size * 2), 0, Math.max(0, depth - size * 2)),
      colorMap: app.assets.find("castleFireParticle", "texture").resource,
      orientation: pc.PARTICLEORIENTATION_SCREEN,
      localVelocityGraph: new pc.CurveSet([[0, 0, 1, 0], [0, (height - size * 2) / lifetime, 1, (height - size * 2) / lifetime], [0, 0, 1, 0]]),
      scaleGraph: new pc.Curve([0, size, 0.3, size, 1, 0]),
      scaleGraph2: new pc.Curve([0, size * 0.45, 0.3, size * 0.65, 1, 0]),
      localVelocityGraph2: new pc.CurveSet([[0, 0, 1, 0], [0, (height - size * 2) * 0.5 / lifetime, 1, (height - size * 2) * 0.5 / lifetime], [0, 0, 1, 0]]),
      colorGraph: new pc.CurveSet([[0, 1, 1, 0.74], [0, 0.72, 0.42, 0.3, 1, 0.025], [0, 0.08, 1, 0]]),
      alphaGraph: new pc.Curve([0, 0, 0.02, 0.8, 0.58, 0.5, 1, 0]),
      alignToMotion: true,
      stretch: height * 0.14,
      startAngle: -8,
      startAngle2: 8,
    });
    root.addChild(emitter);
  }

  get entity() { return this.#entity; }
  get definition() { return this.#definition; }

  /**
   * @param {number} near
   * @param {number} far
   * @param {number[]} [offsets]
   */
  setIslandOffsets(near, far, offsets) { this.#islandRoots.setOffsets(near, far, offsets); }

  destroy() { this.#entity.destroy(); }
}
