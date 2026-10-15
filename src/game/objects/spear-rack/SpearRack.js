import { everyTruthy } from "../../helpers/collections.js";
import { arePositiveFiniteNumbers } from "../../helpers/types.js";
import modelUrl from "../../models/spear-rack/spear-rack.glb?url";
import { AbstractCastleProp } from "../castle-props/AbstractCastleProp.js";
import { GenerationRandom } from "../../generator/map/GenerationRandom.js";

/**
 * Joined arsenal frame with multiple guided spear rows on a shared plinth.
 */
export class SpearRack extends AbstractCastleProp {
  /**
   * @returns {string}
   */
  static get modelUrl() { return modelUrl; }

  /**
   * Assemble identical authored parts for rendering and collision.
   * @param {import("playcanvas").Entity} model
   * @param {boolean} collision
   */
  prepareModel(model, collision) {
    const { height = 1.2, spearSeed } = this.definition;
    const legacy = this.definition.length === undefined && this.definition.depth !== undefined;
    const length = this.definition.length ?? (legacy ? this.definition.width ?? 0.5 : 0.5);
    const width = legacy ? this.definition.depth : this.definition.width ?? 0.25;
    const templates = new Map(["Rack rail", "Rack base", "Rack upright", "Rack foot",
      "Rack crossbeam", "Rack brace", "Rack guide", "Rack socket", "Rack spear"].map(
      /**
       * @param {string} name
       */
      name => [name, model.findByName(name)?.clone()],
    ));
    for (const child of [...model.children]) { child.destroy(); }
    const rows = Math.max(1, Math.floor((width + 1e-6) / 0.25));
    const bays = Math.max(1, Math.ceil(length / 1.8));
    const spears = Math.max(1, Math.floor((length - 0.16 + 1e-6) / 0.18));
    if (arePositiveFiniteNumbers(length, width, height) && rows * (2 + spears * 3) + (bays + 1) * 6 + 4 <= 4096 && everyTruthy(templates.values())) {
      const random = new GenerationRandom(String(spearSeed ?? this.definition.id));
      const sx = Math.min(1, length / 0.25);
      const sz = Math.min(1, width / 0.25);
      const sy = height / 1.2;
      const spanX = Math.max(0, length - 0.11 * sx);
      const spanZ = Math.max(0, width - 0.11 * sz);
      const rowSpan = rows === 1 ? 0 : width - 0.16 * sz;
      const pitch = Math.min(0.22 * sx, spanX / spears);
      const spearSpan = pitch * (spears - 1);
      /**
       * @param {string} type
       * @param {string} name
       * @param {number} x
       * @param {number} y
       * @param {number} z
       * @param {number} scaleX
       * @param {number} scaleY
       * @param {number} scaleZ
       * @returns {import("playcanvas").Entity}
       */
      const add = (type, name, x, y, z, scaleX, scaleY, scaleZ) => {
        const part = templates.get(type).clone();
        part.name = name;
        part.setLocalPosition(x, y * sy, z);
        part.setLocalEulerAngles(0, 0, 0);
        part.setLocalScale(scaleX, scaleY * sy, scaleZ);
        model.addChild(part);
        return part;
      };
      // Two side frames connect every row: no separate rack feet per row.
      for (let index = 0; index <= bays; index++) {
        const x = -spanX / 2 + index * spanX / bays;
        for (const side of [-1, 1]) {
          const z = side * spanZ / 2;
          add("Rack upright", `Rack upright ${index}-${side}`, x, 0.445, z, sx, 1, sz);
          add("Rack foot", `Rack foot ${index}-${side}`, x, 0.0225, z, sx, 1, sz);
        }
        for (const y of [0.09, 0.78]) {
          add("Rack crossbeam", `Rack crossbeam ${index}-${y}`, x, y, 0, sx, 1, spanZ / 0.25);
        }
      }
      for (const side of [-1, 1]) {
        const x = side * spanX / 2;
        const diagonal = Math.hypot(0.62 * sy, spanZ);
        const brace = add("Rack brace", `Rack end brace ${side}`, x, 0.435, 0,
          sx, diagonal / sy, Math.min(sz, sy));
        brace.setLocalEulerAngles(Math.atan2(spanZ, 0.62 * sy) * 180 / Math.PI * side, 0, 0);
        add("Rack base", `Rack perimeter base ${side}`, 0, 0.09, side * spanZ / 2,
          spanX / 0.5, 1, sz);
      }
      for (let row = 0; row < rows; row++) {
        const z = rows === 1 ? 0 : -rowSpan / 2 + row * rowSpan / (rows - 1);
        add("Rack base", `Rack row base ${row}`, 0, 0.09, z, spanX / 0.5, 1, sz);
        add("Rack rail", `Rack guide rail ${row}`, 0, 0.78, z - 0.052 * sz, spanX / 0.5, 1, sz);
        for (let index = 0; index < spears; index++) {
          const x = spears === 1 ? 0 : -spearSpan / 2 + index * spearSpan / (spears - 1);
          const guideScale = pitch / 0.14;
          add("Rack guide", `Rack guide ${row}-${index}`, x, 0.78, z, guideScale, 1, sz);
          add("Rack socket", `Rack socket ${row}-${index}`, x, 0.139, z, sx, 1, sz);
          add("Rack spear", `Rack spear ${row}-${index}`, x, 0.143, z,
            sx, (1.057 / 1.2) * random.rng(96, 100) / 100, sz);
        }
      }
    }
    for (const template of templates.values()) { template?.destroy(); }
  }
}
