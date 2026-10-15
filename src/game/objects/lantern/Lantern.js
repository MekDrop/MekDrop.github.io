import modelUrl from "../../models/castle/props/entrance-lantern.glb?url";
import wallModelUrl from "../../models/castle/props/wall-lantern.glb?url";
import tableModelUrl from "../../models/castle/props/table-lantern.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { LanternGlass } from "./LanternGlass.js";
import { Fire } from "../fire/Fire.js";
import { CastleFire } from "../castle/CastleFire.js";

/**
 * Island-owned lantern model, collision, flame and optional local illumination.
 * Asset variants supply defaults; placements can override lighting without a subclass.
 */
export class Lantern extends AbstractCastleProp {
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);
    const { pc, modelLibrary, definition } = options;
    const root = this.visualRoots[0];
    const model = root.children[0];
    if (definition.collisionBox) {
      const scale = definition.scale ?? 1;
      const stretch = definition.stretch ?? { x: 1, y: 1, z: 1 };
      const { halfExtents, offset } = definition.collisionBox;
      root.addComponent("collision", { type: "box",
        halfExtents: new pc.Vec3(halfExtents.x * scale * stretch.x,
          halfExtents.y * scale * stretch.y, halfExtents.z * scale * stretch.z),
        linearOffset: new pc.Vec3(offset.x * scale * stretch.x,
          offset.y * scale * stretch.y, offset.z * scale * stretch.z) });
      root.addComponent("rigidbody", { type: "static", friction: 0.6, restitution: 0 });
    }
    const type = definition.type ?? "entrance";
    if (definition.flame ?? type !== "wall") {
      LanternGlass.add(pc, model);
      Fire.attach(pc, model, type === "table" ? { x: 0, y: 0.11, z: 0 } : { x: 0, y: 0.102, z: 0.047 },
        { x: 0.025, y: 0.0972, z: 0.025 });
    }
    const settings = definition.lighting === false ? null : definition.lighting ?? (type === "table" ? {
      position: { x: 0, y: 0.15, z: 0 }, color: [1, 0.65, 0.28], intensity: 1.2, range: 2.4, modelSpace: true,
    } : null);
    if (!settings) { return; }
    const parent = settings.modelSpace ? model : root;
    if (settings.flicker) {
      const fire = new CastleFire({ pc, app: pc.Application.getApplication(), modelLibrary });
      fire.add({ ...settings.position, scale: settings.range / 12, brazier: false,
        flame: false, intensity: settings.intensity, phase: settings.phase });
      parent.addChild(fire.entity);
      root.once("destroy", () => fire.destroy());
      return;
    }
    const light = new pc.Entity(`${definition.id} warm light`);
    const { x, y, z } = settings.position;
    light.setLocalPosition(x, y, z);
    light.addComponent("light", { type: "omni", color: new pc.Color(...(settings.color ?? [1, 0.65, 0.28])),
      intensity: settings.intensity, range: settings.range, castShadows: false });
    parent.addChild(light);
  }

  /**
   * @returns {string}
   */
  static get modelUrls() { return [modelUrl, wallModelUrl, tableModelUrl]; }
  /**
   * @returns {string}
   */
  get modelUrl() {
    return this.definition.type === "wall" ? wallModelUrl : this.definition.type === "table" ? tableModelUrl : modelUrl;
  }
  /**
   * Normalize names retained in old maps and castle furnishing plans.
   * @param {import("../ObjectTypes.js").GameMapData} mapData
   */
  static prepareMap(mapData) {
    for (const definition of mapData.objects ?? []) {
      const name = definition.object;
      if (!["EntranceLantern", "WallLantern", "TableLantern", "ServantBedsideLantern", "VestibuleLantern"].includes(name)) { continue; }
      definition.object = Lantern.name;
      definition.type = name === "WallLantern" ? "wall" : name === "TableLantern" ? "table" : "entrance";
      if (definition.lighting !== undefined) { continue; }
      if (name === "ServantBedsideLantern") {
        definition.lighting = { position: { x: 0, y: 0.29, z: 0.18 }, color: [1, 0.62, 0.25], intensity: 1.5, range: 2.4 };
      } else if (name === "VestibuleLantern") {
        definition.lighting = { position: { x: 0, y: 0.23, z: 0.17 }, color: [1, 0.67, 0.3], intensity: 0.65, range: 3 };
      }
    }
  }
}

/**
 * @typedef {{position: import("../ObjectTypes.js").Point3, color?: number[], intensity: number, range: number, modelSpace?: boolean, flicker?: boolean, phase?: number}} LanternLighting
 */
