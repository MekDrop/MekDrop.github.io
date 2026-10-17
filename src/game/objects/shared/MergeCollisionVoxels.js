import { ObjectDataCache } from "../../cache/ObjectDataCache.js";

/**
 * @typedef {{x: number, y: number, z: number}} CollisionCell
 * @typedef {CollisionCell & {width: number, height: number, depth: number}} CollisionBox
 */

/**
 * Packs contiguous grid cells into non-overlapping boxes without filling holes.
 * @param {CollisionCell[]} voxels
 * @param {string} family
 * @returns {CollisionBox[]}
 */
export function mergeCollisionVoxels(voxels, family = "collision-boxes") {
  return ObjectDataCache.resolve(family, voxels, () => generateCollisionBoxes(voxels));
}

/**
 * @param {CollisionCell[]} voxels
 * @returns {CollisionBox[]}
 */
function generateCollisionBoxes(voxels) {
  const original = packCollisionCells(voxels);
  // Filling the canopy first avoids splitting broad layers around a tall trunk.
  const topFirst = packCollisionCells([...voxels].sort(/**
   * @param {CollisionCell} left
   * @param {CollisionCell} right
   */
    (left, right) => right.y - left.y || left.x - right.x || left.z - right.z));

  return topFirst.length < original.length ? topFirst : original;
}

/**
 * @param {CollisionCell[]} voxels
 * @returns {CollisionBox[]}
 */
function packCollisionCells(voxels) {
  const cells = new Set(voxels.map(/**
   * @param {CollisionCell} cell
   */
    (cell) => `${cell.x}:${cell.y}:${cell.z}`));
  const boxes = [];
  for (const { x, y, z } of voxels) {
    if (!cells.has(`${x}:${y}:${z}`)) {
      continue;
    }
    let width = 1, height = 1, depth = 1;
    while (cells.has(`${x + width}:${y}:${z}`)) {
      width++;
    }
    let complete = true;
    while (complete) {
      for (let dx = 0; dx < width; dx++) {
        if (!cells.has(`${x + dx}:${y}:${z + depth}`)) {
          complete = false; break;
        }
      }
      if (complete) {
        depth++;
      }
    }
    complete = true;
    while (complete) {
      for (let dx = 0; dx < width && complete; dx++) {
        for (let dz = 0; dz < depth; dz++) {
          if (!cells.has(`${x + dx}:${y + height}:${z + dz}`)) {
            complete = false; break;
          }
        }
      }
      if (complete) {
        height++;
      }
    }
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        for (let dz = 0; dz < depth; dz++) {
          cells.delete(`${x + dx}:${y + dy}:${z + dz}`);
        }
      }
    }
    boxes.push({
      x,
      y,
      z,
      width,
      height,
      depth,
    });
  }

  return boxes;
}
