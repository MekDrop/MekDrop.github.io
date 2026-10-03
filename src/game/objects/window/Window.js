import hallUrl from "../../models/castle/windows/hall-window.glb?url";
import roomUrl from "../../models/castle/windows/room-window.glb?url";
import slitUrl from "../../models/castle/windows/slit-window.glb?url";

import { WindowLayout } from "./WindowLayout.js";
import { IslandObjectRoots } from "../shared/IslandObjectRoots.js";

/**
 * Authored window insert shared by maps and castle walls; local +Z points outside.
 */
export class Window {
  /**
   * @type {import("playcanvas").Entity}
   */
  #entity;
  /**
   * @type {import("playcanvas").Entity}
   */
  #visual;
  /**
   * @type {import("../ObjectTypes.js").MapObjectDefinition}
   */
  #definition;
  /**
   * @type {IslandObjectRoots}
   */
  #islandRoots;
  /**
   * @returns {string[]}
   */
  static get modelUrls() { return [hallUrl, roomUrl, slitUrl]; }
  /**
   * @param {{pc: typeof import("playcanvas"), modelLibrary: import("../../models/GameModelLibrary.js").GameModelLibrary, definition: import("../ObjectTypes.js").MapObjectDefinition, runtime?: import("../ObjectTypes.js").MapObjectRuntime}} options
   */
  constructor({ pc, modelLibrary, definition, runtime = {} }) {
    this.#definition = definition;
    this.#entity = new pc.Entity(`${definition.id} island ownership`);
    this.#visual = new pc.Entity(`${definition.id} window`);
    this.#visual.tags.add("map-object", definition.id, this.constructor.name);
    this.#islandRoots = new IslandObjectRoots(pc, this.#entity, runtime.mapData);
    this.#islandRoots.addChild(this.#visual, definition.tile);
    Window.addVisual(pc, modelLibrary, this.#visual, definition);
  }
  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} parent
   * @param {import("../ObjectTypes.js").MapObjectDefinition} definition
   * @param {import("playcanvas").Material|null} wallMaterial
   */
  static addVisual(pc, models, parent, definition, wallMaterial = null) {
    const window = WindowLayout.bounds(definition);
    const modelLibrary = models;
  const visual = modelLibrary.instantiate(window.role === "slit" ? slitUrl : window.role === "hall" && window.height > 0.75 ? hallUrl : roomUrl);
  visual.name = `Castle ${window.role} recessed window`;
  // The reveal is part of this wall, including its authored stone texture.
  // Timber and individual translucent panes keep their own materials.
  if (wallMaterial) {
    for (const render of visual.findComponents("render")) {
      for (const mesh of render.meshInstances) {
        if (mesh.material.name.includes("limestone")) {
          mesh.material = wallMaterial;
        }
      }
    }
  }
  // The authored aperture spans x = [-0.5, 0.5] and y = [0, 1].
  // Its stone trim already extends beyond those edges. Shrinking or lifting
  // the insert leaves uncovered strips between the reveal and cut masonry.
  const angle = window.yaw * Math.PI / 180;
  visual.setLocalPosition(window.position.x + Math.sin(angle) * 0.004,
    window.position.y, window.position.z + Math.cos(angle) * 0.004);
  visual.setLocalEulerAngles(0, window.yaw, 0);
  visual.setLocalScale(window.width, window.height, window.depth);
  // The sill overlaps the masonry below the aperture. Separate its top from
  // the wall's horizontal cut face to prevent z-fighting as the camera moves.
  // Correct for parent scaling so the clearance stays two millimetres.
  const sill = visual.findByName("Projecting stone sill");
  if (sill) {
    const position = sill.getLocalPosition();
    sill.setLocalPosition(position.x, position.y + 0.002 / window.height, position.z);
  }
  // The authored bottom rail starts 0.013 above the aperture base. Seat it
  // one millimetre into the raised sill so no uncovered strip remains.
  const bottomRail = visual.findByName("Oak frame rail -1");
  if (bottomRail) {
    const position = bottomRail.getLocalPosition();
    bottomRail.setLocalPosition(position.x, position.y - 0.013 + 0.001 / window.height, position.z);
  }
  parent.addChild(visual);
  const glow = new pc.Entity("Castle amber window glow");
  glow.setLocalPosition(window.position.x - Math.sin(angle) * window.depth * 0.2,
    window.position.y + window.height / 2, window.position.z - Math.cos(angle) * window.depth * 0.2);
  glow.addComponent("light", { type: "omni", color: new pc.Color(1, 0.38, 0.06), intensity: 0.45, range: 0.9, castShadows: false });
  parent.addChild(glow);
  }
  get entity() { return this.#entity; }
  get definition() { return this.#definition; }
  /**
   * @returns {import("playcanvas").Entity[]}
   */
  get visualRoots() { return [this.#visual]; }
  /**
   * @param {number} near
   * @param {number} far
   */
  setIslandOffsets(near, far) { this.#islandRoots.setOffsets(near, far); }
  destroy() { this.#entity.destroy(); }
}
