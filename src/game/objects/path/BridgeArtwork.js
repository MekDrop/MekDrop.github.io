import plankModelUrl from "../../models/bridge/bridge-deck-plank.glb?url";
import stringerModelUrl from "../../models/bridge/bridge-stringer.glb?url";
import dockingCapModelUrl from "../../models/bridge/bridge-docking-cap.glb?url";
import liftRuneModelUrl from "../../models/bridge/bridge-lift-rune.glb?url";
import cantileverBraceModelUrl from "../../models/bridge/bridge-cantilever-brace.glb?url";
import cantileverHardwareModelUrl from "../../models/bridge/bridge-cantilever-hardware.glb?url";
import { BridgePalette } from "./BridgePalette.js";

/**
 * Assembles authored oak modules along the same station profile used by support
 * and destruction. One kit serves the intact bridge and its detached sections.
 */
export class BridgeArtwork {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("../../models/GameModelLibrary.js").GameModelLibrary}
   */
  #models;
  /**
   * @type {import("playcanvas").Entity}
   */
  #root;
  /**
   * @type {BridgePalette}
   */
  #palette;
  /**
   * @type {Map<string, number[]>}
   */
  #matrices = new Map();

  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [plankModelUrl, stringerModelUrl, dockingCapModelUrl, liftRuneModelUrl, cantileverBraceModelUrl, cantileverHardwareModelUrl];
  }

  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, root: import("playcanvas").Entity}} options
   */
  constructor({ pc, modelLibrary, root }) {
    this.#pc = pc;
    this.#models = modelLibrary;
    this.#root = root;
    this.#palette = new BridgePalette(root);
  }

  /**
   * Heights are relative to the station centre's deck top, so a detached station
   * reproduces precisely the intact profile beneath an identity local root.
   * @param {{definition: import("../ObjectTypes.js").MapObjectDefinition, station: number, position: import("playcanvas").Vec3, startRise?: number, endRise?: number, floating?: boolean}} options
   */
  addStation({ definition, station, position, startRise = 0, endRise = 0, floating = false }) {
    const { span } = definition;
    const pitch = -Math.atan2(endRise - startRise, 1) * 180 / Math.PI;
    const yaw = span.horizontal ? 90 : 0;
    const rotation = new this.#pc.Quat().setFromEulerAngles(pitch, yaw, 0);
    const length = Math.hypot(1, endRise - startRise);
    // Two square metre-sized tiles continue the path's two grid lanes.
    this.#addDeckTile(position, rotation, length, span.horizontal, -0.5);
    this.#addDeckTile(position, rotation, length, span.horizontal, 0.5);
    this.#addStringer(position, rotation, length, span.horizontal, -0.82);
    this.#addStringer(position, rotation, length, span.horizontal, 0.82);
    if (floating) {
      // Keep the lift tucked under the timber rather than outlining the deck.
      this.#addMatrix(liftRuneModelUrl, position, rotation, new this.#pc.Vec3(0.65, 1, 1));
      if (station === span.start) {
        this.#addCap(position, span.horizontal, -0.47, yaw + 180);
      }
      if (station === span.end) {
        this.#addCap(position, span.horizontal, 0.47, yaw);
      }
    }
  }

  /**
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Quat} rotation
   * @param {number} length
   * @param {boolean} horizontal
   * @param {number} side
   */
  #addDeckTile(position, rotation, length, horizontal, side) {
    const center = position.clone().add(new this.#pc.Vec3(horizontal ? 0 : side, 0, horizontal ? side : 0));
    this.#addMatrix(plankModelUrl, center, rotation, new this.#pc.Vec3(1, 1, length));
  }

  /**
   * Bank-mounted brackets project beneath the deck from its owning island.
   * @param {{position: import("playcanvas").Vec3, horizontal: boolean, direction: number, length: number}} options
   */
  addIslandSupport({ position, horizontal, direction, length }) {
    const yaw = (horizontal ? 90 : 0) + (direction < 0 ? 180 : 0);
    const rotation = new this.#pc.Quat().setFromEulerAngles(0, yaw, 0);
    this.#addSupportSide(position, rotation, length, horizontal, -0.82);
    this.#addSupportSide(position, rotation, length, horizontal, 0.82);
  }

  /**
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Quat} rotation
   * @param {number} length
   * @param {boolean} horizontal
   * @param {number} side
   */
  #addSupportSide(position, rotation, length, horizontal, side) {
    const center = position.clone().add(new this.#pc.Vec3(horizontal ? 0 : side, 0, horizontal ? side : 0));
    this.#addMatrix(cantileverBraceModelUrl, center, rotation, new this.#pc.Vec3(1, 1, length));
    this.#addMatrix(cantileverHardwareModelUrl, center, rotation, new this.#pc.Vec3(1, 1, length));
  }

  /**
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Quat} rotation
   * @param {number} length
   * @param {boolean} horizontal
   * @param {number} side
   */
  #addStringer(position, rotation, length, horizontal, side) {
    const center = position.clone().add(new this.#pc.Vec3(horizontal ? 0 : side, -0.25, horizontal ? side : 0));
    this.#addMatrix(stringerModelUrl, center, rotation, new this.#pc.Vec3(1, 1, length));
  }

  /**
   * @param {import("playcanvas").Vec3} position
   * @param {boolean} horizontal
   * @param {number} offset
   * @param {number} yaw
   */
  #addCap(position, horizontal, offset, yaw) {
    const center = position.clone().add(new this.#pc.Vec3(horizontal ? offset : 0, 0, horizontal ? 0 : offset));
    const rotation = new this.#pc.Quat().setFromEulerAngles(0, yaw, 0);
    this.#addMatrix(dockingCapModelUrl, center, rotation, this.#pc.Vec3.ONE);
  }

  /**
   * @param {string} url
   * @param {import("playcanvas").Vec3} position
   * @param {import("playcanvas").Quat} rotation
   * @param {import("playcanvas").Vec3} scale
   */
  #addMatrix(url, position, rotation, scale) {
    const matrix = new this.#pc.Mat4().setTRS(position, rotation, scale);
    const matrices = this.#matrices.get(url) ?? [];
    matrices.push(...matrix.data);
    this.#matrices.set(url, matrices);
  }

  /**
   * The caller owns the returned buffers and destroys the attached entities
   * through its visual root. Model materials remain owned by the model library.
   * @returns {import("playcanvas").VertexBuffer[]}
   */
  build() {
    const buffers = [];
    for (const [url, matrices] of this.#matrices) {
      const source = this.#models.instantiate(url);
      const original = source.findComponents("render")[0].meshInstances[0].material;
      const role = url === plankModelUrl ? "deck" : url === liftRuneModelUrl ? "lift" :
        [dockingCapModelUrl, cantileverHardwareModelUrl].includes(url) ? "metal" : "frame";
      const material = this.#palette.materialFor(original, role);
      source.destroy();
      const batch = this.#models.instantiateMergedBatch(url, matrices, {
        name: url === liftRuneModelUrl ? "Bridge lift rune" : "Bridge authored timber and fittings",
        material,
        dynamic: true,
      });
      if (batch) {
        if (role === "deck") {
          batch.entity.tags.add("path-debug-surface");
        }
        this.#root.addChild(batch.entity);
        buffers.push(batch.vertexBuffer);
      }
    }
    this.#matrices.clear();

    return buffers;
  }
}
