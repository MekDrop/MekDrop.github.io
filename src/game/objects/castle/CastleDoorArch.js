import entranceArchModelUrl from "../../models/castle/doors/entrance-arch.glb?url";

const HIDDEN_MORTAR_PREFIXES = [
  "Castle arch solid wedge",
  "Castle arch solid jamb",
];

/**
 *
 * @param {import("playcanvas").Entity} entity
 */
const hideMortarBacking = (entity) => {
  if (HIDDEN_MORTAR_PREFIXES.some(/**
   *
   * @param {string} prefix
   */
  (prefix) => entity.name.startsWith(prefix))) {
    entity.enabled = false;
  }
  for (const child of entity.children) {
    hideMortarBacking(child);
  }
};

/**
 * Imported chunky stone frame around one castle entrance.
 */
export class CastleDoorArch {
  /**
   *
    * @returns {string}
   */
  static get modelUrl() {
    return entranceArchModelUrl;
  }

  /**
   *
    * @type {import("playcanvas").Entity}
   */
  #entity;

  /**
   *
   * @param {{castlePosition: {x: number, z: number, width: number, depth: number, elevation: number}, door: import("src/game/objects/ObjectTypes.js").CastleDoorDefinition, modelLibrary: string}} options
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} options.castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} options.door
   * @param {string} options.modelLibrary
   */
  constructor({ castlePosition, door, modelLibrary, placement = null }) {
    this.#entity = modelLibrary.instantiate(CastleDoorArch.modelUrl);
    this.#entity.name = "Castle door stone arch";
    hideMortarBacking(this.#entity);

    const frame = placement ?? this.#placement(castlePosition, door);
    this.#entity.setLocalPosition(
      frame.x,
      placement?.y ?? castlePosition.elevation,
      frame.z,
    );
    this.#entity.setLocalEulerAngles(0, frame.yaw, 0);
    if (placement) this.#entity.setLocalScale(door.width / 2, placement.height / 2.3, 1);
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
  }

  /**
   *
   * @param {{x: number, z: number, width: number, depth: number, elevation: number}} castlePosition
   * @param {import("src/game/objects/ObjectTypes.js").CastleDoorDefinition} door
   */
  #placement(castlePosition, door) {
    const centerOffset = (door.offset ?? 0) + (door.width ?? 2) / 2;
    const placements = {
      WEST: {
        x: castlePosition.x - 0.035,
        z: castlePosition.z + centerOffset,
        yaw: 90,
      },
      EAST: {
        x: castlePosition.x + castlePosition.width + 0.035,
        z: castlePosition.z + centerOffset,
        yaw: 90,
      },
      NORTH: {
        x: castlePosition.x + centerOffset,
        z: castlePosition.z - 0.035,
        yaw: 0,
      },
      SOUTH: {
        x: castlePosition.x + centerOffset,
        z: castlePosition.z + castlePosition.depth + 0.035,
        yaw: 0,
      },
    };
    return placements[door.side] ?? placements.NORTH;
  }
}
