/**
 * Coalesces touching masonry boxes into solid cuboids without filling openings.
 * @param {Array<{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}>} blocks
 * @returns {Array<{x:number,y:number,z:number,width:number,height:number,depth:number}>}
 */
export function createCastleMasonryVoxels(blocks) {
  let boxes = blocks.map(/**
   * @param {{x:number,y:number,z:number,halfX:number,halfY:number,halfZ:number}} block
   */ (block) => ({ x: block.x, y: block.y, z: block.z,
    width: block.halfX * 2, height: block.halfY * 2, depth: block.halfZ * 2 }));
  const dimensions = { x: "width", y: "height", z: "depth" };
  for (const axis of ["x", "z", "y"]) {
    const size = dimensions[axis];
    const others = ["x", "y", "z"].filter(/**
     * @param {string} value
     */ (value) => value !== axis);
    const groups = new Map();
    for (const box of boxes) {
      const key = others.map(/**
     * @param {string} value
     */ (value) =>
        `${box[value].toFixed(6)}:${box[dimensions[value]].toFixed(6)}`).join("/");
      if (!groups.has(key)) { groups.set(key, []); }
      groups.get(key).push(box);
    }
    boxes = [];
    for (const row of groups.values()) {
      row.sort(/**
       * @param {{x:number,y:number,z:number}} a
       * @param {{x:number,y:number,z:number}} b
       */ (a, b) => a[axis] - b[axis]);
      let previous = null;
      for (const box of row) {
        if (previous && Math.abs(previous[axis] + previous[size] / 2 - box[axis] + box[size] / 2) < 1e-6) {
          const start = previous[axis] - previous[size] / 2;
          const end = box[axis] + box[size] / 2;
          previous[axis] = (start + end) / 2;
          previous[size] = end - start;
        } else { previous = { ...box }; boxes.push(previous); }
      }
    }
  }
  return boxes;
}
