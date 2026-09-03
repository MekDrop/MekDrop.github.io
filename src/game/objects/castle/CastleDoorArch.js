import entranceArchModelUrl from "../../models/castle/doors/entrance-arch.glb?url";

/** Imported chunky stone frame around one castle entrance. */
export class CastleDoorArch {
  static get modelUrl() {
    return entranceArchModelUrl;
  }

  #entity;

  constructor({ castlePosition, door, modelLibrary }) {
    this.#entity = modelLibrary.instantiate(CastleDoorArch.modelUrl);
    this.#entity.name = "Castle door stone arch";

    const placement = this.#placement(castlePosition, door);
    this.#entity.setLocalPosition(
      placement.x,
      castlePosition.elevation,
      placement.z,
    );
    this.#entity.setLocalEulerAngles(0, placement.yaw, 0);
  }

  get entity() {
    return this.#entity;
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
  }

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
