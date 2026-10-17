import { ObjectDataCache } from "./ObjectDataCache.js";

/**
 * Stores local assembly recipes while keeping meshes and entities instance-owned.
 */
export class PropAssemblyCache {
  /**
   * @param {string} family
   * @param {Record<string, unknown>} input
   * @param {import("playcanvas").Entity} model
   * @param {import("playcanvas").Entity[]} templates
   * @param {(add: (index: number, entity: import("playcanvas").Entity) => void) => void} generate
   */
  static populate(family, input, model, templates, generate) {
    let generated = false;
    const layout = ObjectDataCache.resolve(family, input, () => {
      generated = true;
      const records = [];
      generate(/**
       *
       * @param {number} index
       * @param {import("playcanvas").Entity} entity
       */
        (index, entity) => {
          const p = entity.getLocalPosition();
          const q = entity.getLocalRotation();
          const s = entity.getLocalScale();
          records.push({
            index,
            name: entity.name,
            position: [p.x, p.y, p.z],
            rotation: [q.x, q.y, q.z, q.w],
            scale: [s.x, s.y, s.z],
          });
          model.addChild(entity);
        });

      return records;
    });
    if (generated) {
      return;
    }
    for (const record of layout) {
      const entity = templates[record.index].clone();
      entity.name = record.name;
      entity.setLocalPosition(...record.position);
      entity.setLocalRotation(...record.rotation);
      entity.setLocalScale(...record.scale);
      model.addChild(entity);
    }
  }
}
