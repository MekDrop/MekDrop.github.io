/**
 * Query-only contracts. Collaborators never receive Hero or mutate its state.
 *
 * @typedef {object} TerrainMovementState
 * @property {import("../ObjectTypes.js").Point3} position
 * @property {boolean} dodging
 * @property {boolean} fallingToDeath
 * @typedef {TerrainMovementState & {direction: {x: number, z: number}, grounded: boolean, repelled: boolean}} MovementSurfaceState
 * @typedef {object} RiverSourceCover
 * @property {number} col
 * @property {number} row
 * @property {number} centerX
 * @property {number} centerZ
 * @property {number} flowX
 * @property {number} flowZ
 * @property {number} height
 * @typedef {Pick<import("../../collision/GroundCollisionWorld.js").GroundCollisionWorld, "surfaceHeightAt"|"physicsSurfaceHeightAt"|"ceilingHeightAt"|"isMovementBlocked"|"movementRefusalAt">} SurfaceCollisionWorld
 */

export {};
