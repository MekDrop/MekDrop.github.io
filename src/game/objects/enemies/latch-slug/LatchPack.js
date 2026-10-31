import { MAP_TILE_TYPE } from "../../../enum/MapTileType.js";

/**
 * Nearby people are companions; other enemies and props are never pack leaders.
 */
export class LatchPack {
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.leader = null;
    this.greetingUntil = 0;
  }

  /**
   * @returns {import("../shared/Enemy.js").EnemyActor|null}
   */
  resolve() {
    const owner = this.owner;
    if (this.leader && !this.#eligible(this.leader)) {
      this.leader = null;
    }
    if (this.leader) {
      return this.leader;
    }
    const hero = owner.runtime.getHero?.();
    const people = new Set([...owner.actors, hero].filter(Boolean));
    const candidates = [...people].filter(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      actor => this.#person(actor, hero) && this.#eligible(actor));
    candidates.sort(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} a
     * @param {import("../shared/Enemy.js").EnemyActor} b
     */
      (a, b) => owner.distanceTo(a) - owner.distanceTo(b));
    const nearest = candidates.find(/**
     *
     * @param {import("../shared/Enemy.js").EnemyActor} actor
     */
      actor => owner.distanceTo(actor) <= 6 && this.canSee(actor));
    // A companion stays interesting until it leaves the safe social area or range.
    // This avoids oscillating between people crossing each other in a corridor.
    if (!this.leader && nearest) {
      this.leader = nearest;
      this.greetingUntil = owner.elapsed + 0.75;
    }
    return this.leader;
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @param {import("../shared/Enemy.js").EnemyActor} hero
   * @returns {boolean}
   */
  #person(actor, hero) {
    return actor === hero || actor.isRoyal === true || typeof actor.beginGameOver === "function"
      || actor.entity?.tags.has("Servant") || actor.definition?.object === "Servant";
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  #eligible(actor) {
    if (!actor.entity || (actor.entity.parent && actor.entity.enabled === false) || actor.alive === false || actor.isDying
      || this.owner.distanceTo(actor) > 8) {
      return false;
    }
    const p = this.owner.targetPosition(actor);
    const map = this.owner.runtime.mapData;
    if (!map) {
      return true;
    }
    for (const castle of this.owner.actors) {
      const layout = castle.residence?.layout;
      if (!layout) {
        continue;
      }
      const local = layout.toLocal(p.x, p.z);
      const inside = layout.walkableAreas.some(/**
       *
       * @param {{minX:number,maxX:number,minZ:number,maxZ:number,floorY:number}} a
       */
        a => local.x >= a.minX && local.x <= a.maxX
        && local.z >= a.minZ && local.z <= a.maxZ && Math.abs(p.y - a.floorY) < 0.8);
      if (inside) {
        return true;
      }
    }
    const col = Math.round(p.x + (map.cols - 1) / 2);
    const row = Math.round(p.z + (map.rows - 1) / 2);

    const surface = map.heightmap?.[row]?.[col];

    return [MAP_TILE_TYPE.PATH, MAP_TILE_TYPE.ENTRY].includes(map.grid?.[row]?.[col])
      && (!Number.isFinite(surface) || Math.abs(p.y - surface) < 0.8);
  }

  /**
   * @param {import("../shared/Enemy.js").EnemyActor} actor
   * @returns {boolean}
   */
  canSee(actor) {
    const owner = this.owner, physics = owner.app?.systems?.rigidbody;
    if (!physics?.raycastFirst) {
      return true;
    }
    const from = owner.position.clone().add(new owner.pc.Vec3(0, 0.58, 0));
    const to = owner.targetPosition(actor).clone().add(new owner.pc.Vec3(0, 0.8, 0));
    const targetEntity = actor.audienceActor?.entity ?? actor.entity;

    return !physics.raycastFirst(from, to, {
      /**
       * @param {import("playcanvas").Entity} entity
       */
      filterCallback: entity => entity !== owner.entity && !entity.isDescendantOf(owner.entity)
        && entity !== actor.entity && !entity.isDescendantOf(actor.entity)
        && entity !== targetEntity && !entity.isDescendantOf(targetEntity),
    });
  }
}
