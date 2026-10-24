import { Vec2 } from "playcanvas";

/**
 * Seats wall brackets against the nearest masonry face at their mounting height.
 */
export class LanternWallPlacement {
  /**
   * @param {import("../../ObjectTypes.js").GameMapData} map
   */
  static prepareMap(map) {
    const boxes = [];
    const unsupported = new Set();
    for (const item of map.objects ?? []) {
      if (item.object === "Castle") {
        for (const box of item.buildPlan?.geometry?.boxes ?? []) {
          boxes.push(box);
        }
      }
    }
    for (const item of map.objects ?? []) {
      if (item.object !== "Lantern" || item.type === "table" || item.type === "court" || !item.position) {
        continue;
      }
      const scale = item.scale ?? 1;
      const wall = item.type === "wall";
      const back = (wall ? 0.13 : 0.1284) * scale * (item.stretch?.z ?? 1);
      // Measured backplate envelopes in the shipped GLBs, with 5 mm clearance.
      const halfWidth = (wall ? 0.05 : 0.034) * scale * (item.stretch?.x ?? 1) + 0.005;
      const minY = item.position.y + (wall ? 0.075 : 0.344) * scale * (item.stretch?.y ?? 1) - 0.005;
      const maxY = item.position.y + (wall ? 0.242 : 0.431) * scale * (item.stretch?.y ?? 1) + 0.005;
      const height = (minY + maxY) / 2;
      const angle = (item.rotation ?? 0) * Math.PI / 180;
      const bracket = new Vec2(item.position.x - Math.sin(angle) * back,
        item.position.z - Math.cos(angle) * back);
      let distance = Infinity;
      let mount = null;
      for (const box of boxes) {
        if (height < box.y - box.sy / 2 || height > box.y + box.sy / 2) {
          continue;
        }
        const radians = (box.yaw ?? 0) * Math.PI / 180;
        const cos = Math.cos(radians), sin = Math.sin(radians);
        const dx = bracket.x - box.x, dz = bracket.y - box.z;
        const local = new Vec2(dx * cos - dz * sin, dx * sin + dz * cos);
        for (const axis of [0, 1]) {
          for (const sign of [-1, 1]) {
            for (const inset of [0, halfWidth]) {
              const extent = (axis === 0 ? box.sz : box.sx) / 2;
              if (inset > extent) {
                continue;
              }
              const x = axis === 0 ? sign * box.sx / 2 : Math.max(-extent + inset, Math.min(extent - inset, local.x));
              const z = axis === 1 ? sign * box.sz / 2 : Math.max(-extent + inset, Math.min(extent - inset, local.y));
              const gap = Math.hypot(x - local.x, z - local.y);
              if (gap >= distance) {
                continue;
              }
              const normal = new Vec2(axis === 0 ? sign * cos : sign * sin,
                axis === 0 ? -sign * sin : sign * cos);
              const contact = new Vec2(box.x + cos * x + sin * z, box.z - sin * x + cos * z);
              if (!LanternWallPlacement.#supported(boxes, contact, normal, halfWidth, minY, maxY)) {
                continue;
              }
              distance = gap;
              mount = {
                x: box.x + cos * x + sin * z + normal.x * back,
                z: box.z - sin * x + cos * z + normal.y * back,
                rotation: Math.atan2(normal.x, normal.y) * 180 / Math.PI,
              };
            }
          }
        }
      }
      if (mount) {
        item.position.x = mount.x;
        item.position.z = mount.z;
        item.rotation = mount.rotation + 360 * Math.round(((item.rotation ?? 0) - mount.rotation) / 360);
      } else if (boxes.length > 0) {
        unsupported.add(item);
      }
    }
    map.objects = (map.objects ?? []).filter(
      /**
       * @param {import("../../ObjectTypes.js").MapObjectDefinition} item
       */
      item => !unsupported.has(item));
  }

  /**
   * Requires continuous coplanar masonry behind the complete plate rectangle.
   * Adjacent blocks may jointly support it; corners and openings may not.
   * @param {Array<{x:number,y:number,z:number,sx:number,sy:number,sz:number,yaw?:number}>} boxes
   * @param {Vec2} contact
   * @param {Vec2} normal
   * @param {number} halfWidth
   * @param {number} minY
   * @param {number} maxY
   * @returns {boolean}
   */
  static #supported(boxes, contact, normal, halfWidth, minY, maxY) {
    let uncovered = [[-halfWidth, halfWidth, minY, maxY]];
    for (const box of boxes) {
      if (box.y + box.sy / 2 < minY || box.y - box.sy / 2 > maxY) {
        continue;
      }
      const angle = (box.yaw ?? 0) * Math.PI / 180;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const nx = normal.x * cos - normal.y * sin;
      const nz = normal.x * sin + normal.y * cos;
      const alongX = Math.abs(nx) > 1 - 1e-6;
      if (!alongX && Math.abs(nz) < 1 - 1e-6) {
        continue;
      }
      const dx = contact.x - box.x, dz = contact.y - box.z;
      const plane = alongX ? dx * cos - dz * sin : dx * sin + dz * cos;
      const face = alongX ? Math.sign(nx) * box.sx / 2 : Math.sign(nz) * box.sz / 2;
      if (Math.abs(plane - face) > 1e-6) {
        continue;
      }
      const center = -normal.y * dx + normal.x * dz;
      const extent = (alongX ? box.sz : box.sx) / 2;
      const left = center - extent, right = center + extent;
      const bottom = box.y - box.sy / 2, top = box.y + box.sy / 2;
      const remaining = [];
      for (const [x0, x1, y0, y1] of uncovered) {
        const l = Math.max(x0, left), r = Math.min(x1, right);
        const b = Math.max(y0, bottom), t = Math.min(y1, top);
        if (l >= r - 1e-8 || b >= t - 1e-8) {
          remaining.push([x0, x1, y0, y1]);
          continue;
        }
        if (l > x0 + 1e-8) {
          remaining.push([x0, l, y0, y1]);
        }
        if (r < x1 - 1e-8) {
          remaining.push([r, x1, y0, y1]);
        }
        if (b > y0 + 1e-8) {
          remaining.push([l, r, y0, b]);
        }
        if (t < y1 - 1e-8) {
          remaining.push([l, r, t, y1]);
        }
      }
      uncovered = remaining;
      if (uncovered.length === 0) {
        return true;
      }
    }

    return false;
  }
}
