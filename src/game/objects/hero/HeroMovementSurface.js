import { OCCUPANCY } from "../../enum/Occupancy.js";
import {
  STEP_CLEARANCE,
  HERO_COLLISION_HEIGHT,
  MOVEMENT_COLLISION_RADIUS,
  MOVEMENT_FORWARD_COLLISION_OFFSET,
  TERRAIN_BODY_COLLISION_RADIUS,
  TERRAIN_FORWARD_COLLISION_OFFSET,
  TERRAIN_FORWARD_COLLISION_RADIUS,
} from "./HeroSurfaceRules.js";

export class HeroMovementSurface {
  /**
   * @type {import("./HeroTerrain.js").HeroTerrain}
   */
  #terrain;

  /**
   * @type {import("./HeroFootSupport.js").HeroFootSupport}
   */
  #feet;

  /**
   * @type {import("./HeroSurfaceTypes.js").SurfaceCollisionWorld|null}
   */
  #collisionWorld;

  /**
   * Combines scenery, terrain and boot policy without changing Hero state.
   * Each query receives fresh state, including after a respawn or step lift.
   * @param {import("./HeroTerrain.js").HeroTerrain} terrain
   * @param {import("./HeroFootSupport.js").HeroFootSupport} feet
   * @param {import("./HeroSurfaceTypes.js").SurfaceCollisionWorld|null} collisionWorld
   */
  constructor(terrain, feet, collisionWorld) {
    this.#terrain = terrain;
    this.#feet = feet;
    this.#collisionWorld = collisionWorld;
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {import("./HeroSurfaceTypes.js").MovementSurfaceState} state
   * @returns {string}
   */
  occupancyAt(x, z, state) {
    if (this.#overheadClearanceBlockedAt(x, z, state.position.y)) {
      return OCCUPANCY.blocked;
    }
    const facing = state.direction;
    const terrainOccupancy = this.#terrain.occupancyAt(
      state.position.x,
      state.position.z,
      x,
      z,
      state.grounded,
      TERRAIN_BODY_COLLISION_RADIUS,
      state,
    );
    if (terrainOccupancy !== OCCUPANCY.open) {
      return terrainOccupancy;
    }
    const terrainForwardFromX =
      state.position.x + facing.x * TERRAIN_FORWARD_COLLISION_OFFSET;
    const terrainForwardFromZ =
      state.position.z + facing.z * TERRAIN_FORWARD_COLLISION_OFFSET;
    const terrainForwardToX =
      x + facing.x * TERRAIN_FORWARD_COLLISION_OFFSET;
    const terrainForwardToZ =
      z + facing.z * TERRAIN_FORWARD_COLLISION_OFFSET;
    const forwardTerrainOccupancy = this.#terrain.occupancyAt(
      terrainForwardFromX,
      terrainForwardFromZ,
      terrainForwardToX,
      terrainForwardToZ,
      false,
      TERRAIN_FORWARD_COLLISION_RADIUS,
      state,
    );
    if (forwardTerrainOccupancy !== OCCUPANCY.open) {
      return OCCUPANCY.blocked;
    }
    const movementForwardFromX =
      state.position.x + facing.x * MOVEMENT_FORWARD_COLLISION_OFFSET;
    const movementForwardFromZ =
      state.position.z + facing.z * MOVEMENT_FORWARD_COLLISION_OFFSET;
    const movementForwardToX =
      x + facing.x * MOVEMENT_FORWARD_COLLISION_OFFSET;
    const movementForwardToZ =
      z + facing.z * MOVEMENT_FORWARD_COLLISION_OFFSET;
    if (
      this.#collisionWorld?.isMovementBlocked(
        state.position.x,
        state.position.z,
        x,
        z,
        MOVEMENT_COLLISION_RADIUS,
        state.position.y,
        STEP_CLEARANCE,
      )
    ) {
      return OCCUPANCY.blocked;
    }
    if (
      this.#collisionWorld?.isMovementBlocked(
        movementForwardFromX,
        movementForwardFromZ,
        movementForwardToX,
        movementForwardToZ,
        MOVEMENT_COLLISION_RADIUS,
        state.position.y,
        STEP_CLEARANCE,
      )
    ) {
      return OCCUPANCY.blocked;
    }
    if (
      state.grounded &&
      !state.dodging &&
      !state.repelled &&
      !this.#isStandingOnPhysicsManagedSurface(state.position) &&
      this.#feet.unsupportedFootAt(
        x,
        z,
        state.position.y,
        facing,
      ) &&
      !this.#feet.isSafeDescentAt(x, z, state.position.y, facing) &&
      !this.#feet.fullySupportedPositionAhead(
        x,
        z,
        state.position.y,
        facing,
      )
    ) {
      return OCCUPANCY.edge;
    }
    return OCCUPANCY.open;
  }

  /**
   * @param {import("../ObjectTypes.js").Point3} position
   * @returns {boolean}
   */
  #isStandingOnPhysicsManagedSurface(position) {
    const surfaceHeight = this.#collisionWorld?.surfaceHeightAt(
      position.x,
      position.z,
      0,
      position.y + STEP_CLEARANCE,
    );
    if (
      !Number.isFinite(surfaceHeight) ||
      Math.abs(surfaceHeight - position.y) > STEP_CLEARANCE
    ) {
      return false;
    }
    const authoredSurfaceHeight =
      this.#collisionWorld?.physicsSurfaceHeightAt(
        position.x,
        position.z,
      );
    return (
      !Number.isFinite(authoredSurfaceHeight) ||
      authoredSurfaceHeight < surfaceHeight - STEP_CLEARANCE
    );
  }

  /**
   *
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @returns {boolean}
   */
  #overheadClearanceBlockedAt(x, z, elevation) {
    const ceiling = this.#collisionWorld?.ceilingHeightAt(
      x,
      z,
      MOVEMENT_COLLISION_RADIUS,
      elevation,
    );
    return (
      Number.isFinite(ceiling) &&
      elevation + HERO_COLLISION_HEIGHT > ceiling
    );
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").Point3} from
   * @param {import("src/game/objects/ObjectTypes.js").Point3} to
   * @param {import("./HeroSurfaceTypes.js").MovementSurfaceState} state
   * @returns {boolean}
   */
  canEscapeAcross(from, to, state) {
    // Keep the escape on the current connected level. Check the whole body
    // footprint at short intervals, excluding water, holes and unsafe slopes.
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    const steps = Math.ceil(distance / 0.15);
    for (let step = 1; step <= steps; step += 1) {
      const x = from.x + (to.x - from.x) * step / steps;
      const z = from.z + (to.z - from.z) * step / steps;
      for (const [dx, dz] of [
        [0, 0], [0.48, 0], [-0.48, 0], [0, 0.48], [0, -0.48],
      ]) {
        const height = this.#terrain.supportHeightAtPoint(
          x + dx,
          z + dz,
          state.position.y + 0.08,
        );
        if (height === null || Math.abs(height - state.position.y) > 0.08) {
          return false;
        }
      }
      if (
        this.#terrain.occupancyAt(from.x, from.z, x, z, true, 0.48, state) !== OCCUPANCY.open ||
        this.#overheadClearanceBlockedAt(x, z, state.position.y) ||
        this.#collisionWorld?.isMovementBlocked(
          from.x, from.z, x, z, 0.48, state.position.y, STEP_CLEARANCE,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * @param {number} x
   * @param {number} z
   * @param {number} elevation
   * @param {{x: number, z: number}} direction
   * @returns {string|null|undefined}
   */
  refusalAt(x, z, elevation, direction) {
    return this.#collisionWorld?.movementRefusalAt(
      x, z, MOVEMENT_COLLISION_RADIUS, elevation,
    ) ?? this.#collisionWorld?.movementRefusalAt(
      x + direction.x * MOVEMENT_FORWARD_COLLISION_OFFSET,
      z + direction.z * MOVEMENT_FORWARD_COLLISION_OFFSET,
      MOVEMENT_COLLISION_RADIUS, elevation,
    );
  }
}
