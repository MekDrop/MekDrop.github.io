import { Entity, Vec3 } from "playcanvas";
import { CHARACTER_HEIGHT } from "../../config/character-size.js";
import { NpcDoorAvoidance } from "./NpcDoorAvoidance.js";

const RADIUS = 0.35;

/**
 * An unscaled Ammo body follows the servant's avoidance root.
 */
export class ServantHeroClearance {
  /**
   * @type {Entity}
   */
  #actor;
  /**
   * @type {Entity}
   */
  #body;
  /**
   * @type {import("playcanvas").AppBase}
   */
  #app;
  /**
   * @type {import("playcanvas").EventHandle}
   */
  #handle;

  /**
   * @param {Entity} actor
   * @param {import("playcanvas").AppBase} app
   */
  constructor(actor, app) {
    this.#actor = actor;
    this.#app = app;
    this.#body = new Entity("Servant body collider", app);
    this.#body.tags.add("hero-surface-ignore");
    this.#body.enabled = false;
    app.root.addChild(this.#body);
    this.#body.addComponent("collision", {
      type: "capsule", axis: 1, radius: RADIUS, height: CHARACTER_HEIGHT,
    });
    this.#body.addComponent("rigidbody", {
      type: "kinematic", friction: 0, restitution: 0,
    });
    this.#handle = app.on("prerender", this.#sync);
  }

  /**
   * @type {() => void}
   */
  #sync = () => {
    this.#body.enabled = this.#actor.enabled;
    if (!this.#body.enabled) { return; }
    const position = this.#actor.getPosition();
    this.#body.rigidbody.teleport(position.x, position.y + CHARACTER_HEIGHT / 2, position.z);
    const hero = this.#app.root.findByName("Hero");
    if (!hero?.enabled || !hero.rigidbody) { return; }
    /**
     * @param {import("yuka").Vector3} point
     */
    const hazard = (point) => {
      const current = hero.getPosition();
      const velocity = hero.rigidbody.linearVelocity;
      return Math.abs(point.y - current.y) < CHARACTER_HEIGHT &&
        (Math.hypot(point.x - current.x, point.z - current.z) < 1.1 ||
          Math.hypot(point.x - current.x - velocity.x * 0.2,
            point.z - current.z - velocity.z * 0.2) < 1.1);
    };
    /**
     * @param {import("yuka").Vector3} point
     */
    const canMove = (point) => {
      const current = hero.getPosition();
      if (Math.abs(point.y - current.y) < CHARACTER_HEIGHT &&
        Math.hypot(point.x - current.x, point.z - current.z) < 0.75) { return false; }
      const physics = this.#app.systems.rigidbody;
      /**
       * @param {Entity} entity
       */
      const filterCallback = (entity) => entity !== this.#body && entity !== hero &&
        !entity.isDescendantOf(hero);
      // Engine rays reserve the body footprint and prevent stepping off the floor.
      for (const height of [0.4, CHARACTER_HEIGHT - 0.2]) {
        const start = new Vec3(point.x, point.y + height, point.z);
        const origin = this.#actor.getPosition();
        if (physics.raycastFirst(new Vec3(origin.x, start.y, origin.z), start,
          { filterCallback })) { return false; }
        for (let side = 0; side < 8; side++) {
          const angle = side * Math.PI / 4;
          if (physics.raycastFirst(start, new Vec3(point.x + Math.cos(angle) * RADIUS,
            start.y, point.z + Math.sin(angle) * RADIUS), { filterCallback })) { return false; }
        }
      }
      const floor = physics.raycastFirst(new Vec3(point.x, point.y + 0.15, point.z),
        new Vec3(point.x, point.y - 0.25, point.z), { filterCallback });
      return Boolean(floor && floor.normal.y > 0.65);
    };
    NpcDoorAvoidance.requestClearance(hero, hazard, canMove, this.#actor);
  };

  destroy() {
    this.#handle.off();
    this.#body.destroy();
  }
}
