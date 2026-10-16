/**
 * @typedef {object} DoorMaterialBinding
 * @property {string} material Material slot in options.materials.
 * @property {string[]} [names]
 * @property {string[]} [prefixes]
 */

/**
 * @typedef {object} DoorCollision
 * @property {(start: import("playcanvas").Vec3, end: import("playcanvas").Vec3) => (number|null)} raycast
 * @property {(x: number, y: number, z: number, radius: number) => boolean} blocksAt
 * @property {() => void} destroy
 * @property {import("./DoorSwingPhysics.js").DoorSwingPhysics} [swing]
 * @property {() => void} [syncFrameBodies]
 */

/**
 * @typedef {object} DoorOptions
 * @property {import("playcanvas").Entity} [entity] Instantiated model or root, owned by Door.
 * @property {import("playcanvas").Entity} [animationEntity] Moving model beneath the root.
 * @property {typeof import("playcanvas")} [pc] Required for rectangular leaf queries.
 * @property {string|null} [frameModelUrl] Optional surrounding structure.
 * @property {string|null} [name]
 * @property {DoorMaterialBinding[]} [materialBindings]
 * @property {Record<string, import("playcanvas").Material>} [materials]
 * @property {import("playcanvas").Material[]} [ownedMaterials] Instance-specific materials released with the door.
 * @property {{width: number, height: number, depth: number}} [leafBounds]
 * @property {import("../../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
 * @property {string} modelUrl
 * @property {string} animationName Authored opening clip.
 * @property {DoorCollision|(() => DoorCollision)} [collision] Queries or a factory evaluated after the initial animation pose.
 * @property {{x: number, y: number, z: number}} [center]
 * @property {{x: number, z: number}} [inward]
 * @property {{x: number, z: number}} [tangent]
 * @property {number} [width]
 * @property {number} [height]
 * @property {boolean} [upperFloor] Limit proximity activation to this floor.
 * @property {boolean} [elevated] Exclude from ground navigation queries.
 * @property {boolean} [exteriorEntrance]
 * @property {number} [openSpeed]
 * @property {boolean} [automatic] Enable proximity opening.
 * @property {(() => boolean)|null} [onOpen]
 * @property {string|null} [hingeName]
 * @property {string|null} [handleName]
 */
export {};
