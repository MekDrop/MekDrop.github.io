/**
 * @typedef {object} DoorScratchStroke
 * @property {import("playcanvas").Vec3} start
 * @property {import("playcanvas").Vec3} end
 * @property {import("playcanvas").Vec3} inward Local displacement per world-space metre.
 * @property {number} radius World-space half width.
 * @property {number} depth World-space cut depth.
 * @property {boolean} directional Whether the cut widens toward the stroke end.
 */

/**
 * @typedef {object} DoorScratchRecord
 * @property {import("playcanvas").MeshInstance} instance
 * @property {import("playcanvas").MeshInstance} originalInstance
 * @property {import("playcanvas").RenderComponent|null} render
 * @property {import("playcanvas").Mesh} source
 * @property {import("playcanvas").Mesh} mesh
 * @property {number[]} positions
 * @property {number[]} indices
 * @property {number[]} uvs
 * @property {import("playcanvas").Material} material
 * @property {import("playcanvas").Material|null} ownedMaterial
 * @property {DoorScratchStroke[]} strokes
 * @property {number} [maximumDepth]
 */

/**
 * @typedef {object} DoorScratchVertex
 * @property {import("playcanvas").Vec3} point
 * @property {import("playcanvas").Vec2} uv
 */
export {};
