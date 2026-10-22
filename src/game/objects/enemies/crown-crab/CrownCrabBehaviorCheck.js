/**
 * Saved-map integration audit using production bodies, contacts and Yuka states.
 */
export class CrownCrabBehaviorCheck {
  /**
   * @param {import("./CrownCrab.js").CrownCrab} owner
   */
  constructor(owner) {
    this.owner = owner;
    this.results = [];
  }

  /**
   * @param {number} seconds
   * @param {Function|null} sample
   */
  wait(seconds, sample = null) {
    return new Promise(/**
                        * @param {() => void} resolve
                        */ (resolve) => {
        let elapsed = 0;
        const handle = this.owner.app.on("postrender", () => {
          elapsed += this.owner.deltaTime;
          if (this.royal) {
            this.nearestRoyal = Math.min(this.nearestRoyal, this.owner.distanceTo(this.royal));
          }
          sample?.();
          if (elapsed >= seconds) {
            handle.off();
            resolve();
          }
        });
      });
  }

  /**
   * @param {string} name
   * @param {boolean} passed
   * @param {Record<string,unknown>} evidence
   */
  record(name, passed, evidence) {
    this.results.push({
      name,
      passed,
      evidence,
    });
    this.owner.checkStatus = `${name}: ${passed ? "pass" : "FAIL"}`;
    console.info("CROWN_CRAB_BEHAVIOR", JSON.stringify(this.results.at(-1)));
  }

  async run() {
    const crab = this.owner;
    const hero = crab.actors.find(/**
                                   * @param {import("../../ObjectTypes.js").MapObjectLike} actor
                                   */ (actor) => actor.constructor.name === "Hero");
    const rival = crab.actors.find(/**
                                    * @param {import("../../ObjectTypes.js").MapObjectLike} actor
                                    */ (actor) => actor.definition?.id === "crab-rival");
    const blocker = crab.actors.find(/**
                                      * @param {import("../../ObjectTypes.js").MapObjectLike} actor
                                      */ (actor) => actor.definition?.id === "crab-queue-blocker");
    const castle = crab.actors.find(/**
                                     * @param {import("../../ObjectTypes.js").MapObjectLike} actor
                                     */ (actor) => actor.definition?.id === "crab-castle");
    await this.wait(0.5);
    const royal = crab.resolveRoyalTarget();
    const royalStart = crab.targetPosition(royal)?.clone();
    this.royal = royal;
    this.nearestRoyal = Infinity;
    blocker.testPlayClip("idle");
    blocker.entity.rigidbody.teleport(0, 2.02, -8);
    const start = crab.position.clone();
    const states = new Set();
    crab.resumePursuit();
    await this.wait(8, () => states.add(crab.stateName));
    this.record("queue", states.has("CrownCrabQueueState") && crab.position.z > -8.5, {
      states: [...states],
      start,
      end: crab.position.clone(),
      blocker: blocker.position.clone(),
    });
    crab.testPlayClip("idle");
    blocker.testPlayClip("idle");
    blocker.entity.rigidbody.teleport(8, 2.02, -12);
    crab.entity.rigidbody.teleport(0, 2.02, -7.2);
    castle.testEntranceOpenAmount = 0;
    await this.wait(2);
    const closed = castle.entranceDoors.map(/**
                                             * @param {import("../../architecture/door/Door.js").Door} door
                                             */ (door) => door.openAmount);
    let maximumOpen = 0;
    const probeStart = crab.position.clone().add(new crab.pc.Vec3(0, 0.5, 0));
    const probeEnd = probeStart.clone().add(new crab.pc.Vec3(0, 0, 2));
    const probeHits = crab.app.systems.rigidbody.raycastAll(probeStart, probeEnd).map(/**
                                                                                       * @param {import("playcanvas").RaycastResult} hit
                                                                                       */ (hit) => hit.entity.name);
    const doorStates = new Set();
    let furthestZ = crab.position.z;
    crab.resumePursuit();
    await this.wait(20, () => {
      doorStates.add(crab.stateName);
      furthestZ = Math.max(furthestZ, crab.position.z);
      maximumOpen = Math.max(maximumOpen, ...castle.entranceDoors.map(/**
                                                                       * @param {import("../../architecture/door/Door.js").Door} door
                                                                       */ (door) => door.openAmount));
    });
    this.record("entrance", Math.max(...closed) < 0.1 && maximumOpen > 0.75 && furthestZ > -5.7, {
      closed,
      maximumOpen,
      furthestZ,
      probeHits,
      states: [...doorStates],
      position: crab.position.clone(),
    });
    crab.testPlayClip("idle");
    crab.entity.rigidbody.teleport(0, 2.02, -10);
    rival.entity.rigidbody.teleport(0, 2.02, -11.1);
    rival.testPlayClip("idle");
    await this.wait(0.2);
    const before = rival.health;
    crab.startClaw(rival);
    await this.wait(0.7);
    const afterContact = rival.health;
    crab.testPlayClip("idle");
    await this.wait(0.7);
    this.record("duel", afterContact < before && rival.health === afterContact, {
      before,
      afterContact,
      afterRecovery: rival.health,
    });
    rival.testPlayClip("idle");
    const beforeStun = rival.health;
    crab.startClaw(rival);
    crab.applyStatus("stun", { duration: 0.6 });
    await this.wait(0.1);
    const interrupted = crab.stateName;
    await this.wait(1.1);
    this.record("stun", interrupted === "CrownCrabStunnedState" && rival.health === beforeStun && !crab.statuses.has("stun"), {
      interrupted,
      recovered: crab.stateName,
      before: beforeStun,
      after: rival.health,
    });
    crab.testPlayClip("idle");
    rival.entity.rigidbody.teleport(8, 2.02, -10);
    crab.onBellRung({
      eventId: "crown-crab-audit",
      source: hero,
    });
    this.record("bell", crab.angerTarget === hero && !crab.statuses.has("confused"), {
      state: crab.stateName,
      confused: crab.statuses.has("confused"),
    });
    crab.testPlayClip("idle");
    crab.beginCarry(hero);
    await this.wait(0.15);
    const carried = crab.carrier === hero && crab.stateName === "CrownCrabCarriedState";
    const height = crab.position.y;
    crab.launch({
      velocity: {
        x: 0,
        y: 4,
        z: 3,
      },
      thrower: hero,
    });
    let top = height;
    const flightStates = new Set();
    await this.wait(2.5, () => {
      top = Math.max(top, crab.position.y);
      flightStates.add(crab.stateName);
    });
    this.record("throw", carried && top > height + 0.1 && flightStates.has("CrownCrabLandingState") && crab.revengeTarget === hero && !crab.airborne, {
      carried,
      height,
      top,
      states: [...flightStates],
      airborne: crab.airborne,
      grounded: crab.grounded,
    });
    crab.testPlayClip("idle");
    crab.revengeTarget = null;
    crab.angerTarget = null;
    if (!crab.reachedRoyals.has(royal)) {
      crab.entity.rigidbody.teleport(0, 2.02, -5);
    }
    castle.testEntranceOpenAmount = null;
    const contacts = new Set();
    const contactHandle = crab.entity.rigidbody.on("contact", /**
                                                               * @param {import("playcanvas").ContactResult} result
                                                               */ (result) => {
        const sideContact = result.contacts.some(/**
                                * @param {import("playcanvas").ContactPoint} point
                                */ (point) => Math.abs(point.normal.y) < 0.5);
        if (sideContact) {
          contacts.add(result.other.name);
        }
      });
    if (!crab.reachedRoyals.has(royal)) {
      crab.resumePursuit();
      await this.wait(60);
    }
    const nearest = this.nearestRoyal;
    const royalEnd = crab.targetPosition(royal)?.clone();
    contactHandle.off();
    const blockers = crab.app.systems.rigidbody.raycastAll(crab.position.clone().add(new crab.pc.Vec3(0, 0.5, 0)), royalEnd.clone().add(new crab.pc.Vec3(0, 0.5, 0))).map(/**
                                                                                                                                                                           * @param {import("playcanvas").RaycastResult} hit
                                                                                                                                                                           */ (hit) => ({
        name:hit.entity.name,
        point:hit.point,
      }));
    crab.testPlayClip("idle");
    this.record("royal", crab.reachedRoyals.has(royal) && nearest < 1.4 && royalStart.distance(royalEnd) > 0.05, {
      nearest,
      distanceScope: "Entire audit, including the initial closed-entrance traversal",
      royalStart,
      royalEnd,
      accepted: crab.reachedRoyals.has(royal),
      clearContact: crab.hasClearContact(royal),
      contacts: [...contacts],
      navigation: crab.navigation.diagnostics,
      blockers,
      waypoint: crab.navigation.next(royal)?.position,
      crab: crab.position.clone(),
    });
    const entity = crab.entity;
    crab.receiveDamage(1000);
    await this.wait(1.7);
    this.record("death", !entity.parent && !crab.animationPlayback, {
      attached: !!entity.parent,
      playbackPresent: !!crab.animationPlayback,
    });
    const link = document.createElement("a");
    link.id = "crown-crab-behavior-download";
    link.hidden = true;
    link.download = "crown-crab-behavior.json";
    link.href = `data:application/json,${encodeURIComponent(JSON.stringify({
      source: "saved-map production Ammo audit",
      results: this.results,
    }))}`;
    document.body.appendChild(link);
    console.info("CROWN_CRAB_BEHAVIOR_COMPLETE", JSON.stringify(this.results.map(/**
                                                                                  * @param {{name:string,passed:boolean}} result
                                                                                  */ (result) => ({
        name: result.name,
        passed: result.passed,
      }))));
  }
}
