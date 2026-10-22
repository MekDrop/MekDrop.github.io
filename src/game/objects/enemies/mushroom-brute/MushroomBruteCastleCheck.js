class MushroomBruteCastleFixtureError extends Error {
  constructor() {
    super("Castle and production royal are required in the saved fixture.");

    this.name = "MushroomBruteCastleFixtureError";
  }
}

/**
 * Destructive, map-owned acceptance check using the real castle and royal.
 * Reload the fixture before repeating it.
 */
export class MushroomBruteCastleCheck {
  /**
   * @param {import("./MushroomBrute.js").MushroomBrute} owner
   * @returns {Promise<object>}
   */
  static async run(owner) {
    const previousScale = owner.app.timeScale;
    const report = {
      clock: "controlled_engine_fixed_step",
      stepSeconds: 1 / 60,
      passed: false,
    };
    try {
      owner.app.timeScale = 1;
      const castle = owner.actors.find(MushroomBruteCastleCheck.#castle);
      const royal = owner.resolveRoyalTarget();
      if (!castle || !royal) {
        throw new MushroomBruteCastleFixtureError();
      }
      for (const actor of owner.actors) {
        if (actor.isEnemy) {
          actor.testPlayClip?.("idle");
        }
        if (actor.constructor.name === "Hero") {
          const body = actor.entity.findComponents("rigidbody")[0];
          body?.teleport(12, 2.014, -18);
        }
      }
      const doors = castle.entranceDoors;
      const door = doors[0];
      const center = door.entity.getPosition().clone();
      const target = owner.targetPosition(royal).clone();
      const inward = target.clone().sub(center);
      inward.y = 0;
      inward.normalize();
      const staging = center.clone().sub(inward.clone().mulScalar(1.1));
      staging.y = owner.definition.position.y;
      owner.entity.rigidbody.teleport(staging);
      castle.testEntranceOpenAmount = 0;
      await MushroomBruteCastleCheck.#steps(owner, 120);
      const initialHit = owner.findBlockingDoor(royal);
      report.staging = {
        center: center.toArray(),
        royal: target.toArray(),
        brute: owner.position.toArray(),
        initialDoorDistance: initialHit?.distance ?? null,
      };
      const before = doors.map(MushroomBruteCastleCheck.#door);
      const health = doors.map(MushroomBruteCastleCheck.#health);
      const impacts = [];
      owner.resumeBehavior();
      for (let frame = 0; frame < 720 && !doors.some(MushroomBruteCastleCheck.#broken); frame++) {
        owner.app.update(1 / 60);
        for (let index = 0; index < doors.length; index++) {
          if (doors[index].health !== health[index]) {
            impacts.push({
              seconds: (frame + 1) / 60,
              door: index,
              before: health[index],
              after: doors[index].health,
              state: owner.stateName,
            });
            health[index] = doors[index].health;
            owner.app.render();
          }
        }
      }
      owner.testPlayClip("idle");
      const broken = doors.find(MushroomBruteCastleCheck.#broken);
      const rayStart = owner.position.clone().add(new owner.pc.Vec3(0, 0.7, 0));
      const rayEnd = rayStart.clone().add(inward.clone().mulScalar(2.2));
      const passageHit = owner.firstContact(rayStart, rayEnd);
      const framePreserved = Boolean(broken?.entity.parent);
      report.doors = {
        before,
        after: doors.map(MushroomBruteCastleCheck.#door),
        impacts,
        framePreserved,
        passageObstruction: passageHit?.entity.name ?? null,
        passed: Boolean(broken) && impacts.length === 3 && framePreserved && !passageHit,
      };
      castle.testEntranceOpenAmount = null;
      console.info("MUSHROOM_BRUTE_CASTLE_DOORS", JSON.stringify(report));

      // Stage contact beside the real seated actor; no duplicate royal or proxy.
      const royalPoint = owner.targetPosition(royal).clone();
      const contact = royalPoint.clone().sub(inward.clone().mulScalar(1.1));
      contact.y = royalPoint.y;
      owner.entity.rigidbody.teleport(contact);
      owner.resumeBehavior();
      const royalStart = royalPoint.toArray();
      for (let frame = 0; frame < 150 && !owner.hasReachedRoyal(royal); frame++) {
        owner.app.update(1 / 60);
      }
      const contactAccepted = owner.hasReachedRoyal(royal);
      const contactState = owner.stateName;
      const clearContact = owner.hasClearContact(royal);
      owner.testPlayClip("idle");
      const poses = [];
      for (let frame = 0; frame < 480; frame++) {
        owner.app.update(1 / 60);
        if (frame % 60 === 0) {
          owner.app.render();
          poses.push(owner.targetPosition(royal).toArray());
        }
      }
      const moved = poses.some(/**
       * @param {number[]} pose
       */
        (pose) => pose.some(/**
         * @param {number} value
         * @param {number} index
         */
          (value, index) => Math.abs(value - royalStart[index]) > 0.02));
      report.royal = {
        constructor: royal.constructor.name,
        contactAccepted,
        contactState,
        clearContact,
        start: royalStart,
        poses,
        moved,
        passed: contactAccepted && moved,
      };
      report.passed = report.doors.passed && report.royal.passed;
      owner.app.render();
    } catch (error) {
      report.error = String(error?.stack ?? error);
    } finally {
      owner.app.timeScale = previousScale;
      owner.testPlayClip("idle");
    }
    console.info("MUSHROOM_BRUTE_CASTLE", JSON.stringify(report));
    const link = document.createElement("a");
    link.download = "mushroom-brute-castle-check.json";
    link.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    link.click();

    return report;
  }

  /**
   * @param {import("./MushroomBrute.js").MushroomBrute} owner
   * @param {number} count
   */
  static async #steps(owner, count) {
    for (let frame = 0; frame < count; frame++) {
      owner.app.update(1 / 60);
    }
    owner.app.render();
  }

  /**
   * @param {import("../../castle/Castle.js").Castle} actor
   */
  static #castle(actor) {
    return Array.isArray(actor.entranceDoors) && actor.entranceDoors.length > 0;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   */
  static #health(door) {
    return door.health;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   */
  static #broken(door) {
    return door.broken;
  }

  /**
   * @param {import("../../architecture/door/Door.js").Door} door
   */
  static #door(door) {
    return {
      name: door.entity.name,
      health: door.health,
      broken: door.broken,
      openAmount: door.openAmount,
      frameAttached: Boolean(door.entity.parent),
      bodies: door.entity.findComponents("rigidbody").length,
      activeBodies: door.entity.findComponents("rigidbody").filter(MushroomBruteCastleCheck.#activeBody).length,
    };
  }

  /**
   * @param {import("playcanvas").RigidBodyComponent} body
   */
  static #activeBody(body) {
    return body.enabled && body.entity.enabled;
  }
}
