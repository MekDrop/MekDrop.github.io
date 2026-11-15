import { LATCH_SLUG_ANIMATION as ANIMATION } from "./LatchSlugAnimation.js";

/**
 * Cooperative motor steering. Ammo retains gravity and collision response;
 * peers stop before contact rather than using impulses to push a queue.
 */
export class LatchPeerYield {
  /**
   * @type {import("./LatchSlug.js").LatchSlug|null}
   */
  requester = null;
  /**
   * @type {import("./LatchSlug.js").LatchSlug|null}
   */
  receiver = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  home = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  aside = null;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  direction = null;
  /**
   * @type {number}
   */
  age = 0;
  /**
   * @type {string}
   */
  phase = "";
  /**
   * @type {boolean}
   */
  bridgePassage = false;

  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * @returns {boolean}
   */
  get available() {
    const b = this.owner;

    return b.alive && !b.carrier && !b.airborne && !b.gatewayArrival.active
      && !b.statuses.has("stun") && !b.statuses.has("confused")
      && (["LatchSeekState", "LatchDogState", "LatchAnnoyedState"].includes(b.stateName) || this.bridgeTravel);
  }

  /**
   * @returns {boolean}
   */
  get bridgeTravel() {
    const b = this.owner;
    const state = b.behavior?.currentState;

    return b.stateName === "LatchBridgeState" && Boolean(state) && !state.contactLatch?.point &&
      !state.spreading && state.recoveringAge === null && !state.bankReturn;
  }

  /**
   * @returns {boolean}
   */
  get requestsPassage() {
    return this.owner.annoyance.active || this.bridgeTravel;
  }

  /**
   * @param {import("./LatchSlug.js").LatchSlug} peer
   * @returns {boolean}
   */
  #canAsk(peer) {
    if (!peer.peerYield.requestsPassage) {
      return true;
    }
    if (this.owner.annoyance.active !== peer.annoyance.active) {
      return this.owner.annoyance.active;
    }
    if (this.bridgeTravel && peer.peerYield.bridgeTravel) {
      const staging = Boolean(this.owner.behavior.currentState.assignment?.staging);
      const peerStaging = Boolean(peer.behavior.currentState.assignment?.staging);
      if (staging !== peerStaging) {
        return !staging;
      }
    }

    return this.bridgeTravel && peer.peerYield.bridgeTravel && this.#priorityKey() < peer.peerYield.#priorityKey();
  }

  /**
   * @returns {string}
   */
  #priorityKey() {
    const owner = this.owner;

    return `${owner.definition?.id ?? ""}:${owner.entity.getGuid?.() ?? owner.actors.indexOf(owner)}`;
  }

  /**
   * @param {import("./LatchSlug.js").LatchSlug} requester
   * @param {import("playcanvas").Vec3} fallback
   * @returns {import("playcanvas").Vec3}
   */
  #travelDirection(requester, fallback) {
    if (!requester.peerYield.bridgeTravel) {
      return fallback;
    }
    const state = requester.behavior.currentState;
    const target = state.assignment?.waypoints?.[state.waypointIndex] ?? state.assignment?.approach;
    if (!target) {
      return fallback;
    }
    const heading = target.clone().sub(requester.position);
    heading.y = 0;

    return heading.length() > 0.05 ? heading.normalize() : fallback;
  }

  /**
   * @returns {import("./LatchSlug.js").LatchSlug|null}
   */
  get attentionTarget() {
    return this.requester ?? this.receiver;
  }

  constrain() {
    const b = this.owner, body = b.entity.rigidbody;
    if (!body || !this.available) {
      return;
    }
    const actors = b.runtime.objects?.getWithMethod?.("clearPeerStep") ?? b.actors;
    for (const peer of actors) {
      if (peer === b || !peer.peerYield || !peer.alive || peer.carrier || peer.airborne || peer.isBridgeCommitted ||
        peer.entity?.rigidbody?.enabled === false
        || Math.abs(peer.position.y - b.position.y) > 0.6) {
        continue;
      }
      const offset = peer.position.clone().sub(b.position);
      offset.y = 0;
      const distance = offset.length();
      const velocity = body.linearVelocity.clone();
      const speed = Math.hypot(velocity.x, velocity.z);
      if (distance < 0.001 || distance > b.radius + peer.radius + 0.08 + speed * b.deltaTime) {
        continue;
      }
      offset.mulScalar(1 / distance);
      const closing = velocity.dot(offset);
      if (closing <= 0) {
        continue;
      }
      body.linearVelocity = velocity.sub(offset.clone().mulScalar(closing));
      if (this.requestsPassage && peer.peerYield.available && !this.receiver && !this.requester
        && this.#canAsk(peer) && !peer.peerYield.requester && !peer.peerYield.receiver) {
        peer.peerYield.#request(b, offset);
      }
    }
  }

  /**
   * @param {import("./LatchSlug.js").LatchSlug} requester
   * @param {import("playcanvas").Vec3} direction
   */
  #request(requester, direction) {
    const b = this.owner;
    const repeated = this.requester === requester;
    const home = repeated ? this.home.clone() : b.position.clone();
    const heading = this.#travelDirection(requester, direction);
    const normal = new b.pc.Vec3(heading.z, 0, -heading.x);
    const lateral = b.position.clone().sub(requester.position).dot(normal);
    const preferred = requester.peerYield.bridgeTravel && lateral > 0 ? 1 : -1;
    for (const sign of [preferred, -preferred]) {
      // The motor deliberately stops within 0.06m of its target. Keep that
      // arrival tolerance outside the wait-phase corridor revalidation band.
      const arrivalBuffer = requester.peerYield.bridgeTravel ? 0.08 : 0;
      const amount = sign * (b.radius + requester.radius + 0.16 + arrivalBuffer) - (requester.peerYield.bridgeTravel ? lateral : 0);
      const aside = b.position.clone().add(normal.clone().mulScalar(amount));
      if (!b.clearPeerStep(aside, requester)) {
        continue;
      }
      this.requester = requester;
      this.bridgePassage = requester.peerYield.bridgeTravel;
      requester.peerYield.receiver = b;
      this.home = home;
      this.aside = aside;
      this.direction = heading.clone();
      this.age = 0;
      this.phase = repeated ? "aside" : "notice";
      b.stop();
      requester.stop();
      b.playClip(ANIMATION.STARTLED);
      requester.playClip(ANIMATION.NUDGE);

      return;
    }
  }

  /**
   * Runs after ordinary behavior and affection so neither can overwrite a yield.
   * @param {number} dt
   */
  update(dt) {
    const b = this.owner;
    if (!this.available) {
      this.cancel();

      return;
    }
    if (this.receiver) {
      if (!this.receiver.peerYield.available || this.receiver.peerYield.requester !== b) {
        this.cancel();
      } else if (["notice", "aside"].includes(this.receiver.peerYield.phase)) {
        b.stop();
        b.playClip(ANIMATION.NUDGE);
      }
    }
    const peer = this.requester;
    if (!peer) {
      this.constrain();

      return;
    }
    this.age += dt;
    if (!peer.peerYield.available || !peer.peerYield.requestsPassage) {
      this.phase = "return";
    }
    if (this.phase === "notice") {
      b.stop();
      b.playClip(this.age < 0.3 ? ANIMATION.STARTLED : ANIMATION.TURN);
      if (this.age >= (this.bridgePassage ? 0.2 : 0.7) && b.pack.canSee(peer)) {
        this.phase = "aside";
      }
    } else if (this.phase === "aside") {
      if (this.bridgePassage && this.#corridorClear(peer)) {
        // A crowded bank can block the final few centimetres of a sidestep.
        // Release the passer once the actual native body already clears its
        // corridor instead of waiting forever for an unnecessarily exact pose.
        b.stop();
        this.phase = "wait";
      } else if (!b.clearPeerStep(this.aside, peer)) {
        b.stop();
        if (this.bridgePassage && this.age >= 2) {
          this.#request(peer, this.direction);
        }
      } else if (b.position.distance(this.aside) > 0.06) {
        b.moveToward({ position: this.aside }, this.bridgePassage ? 0.95 : 0.65, 0.04);
        b.playClip(ANIMATION.SCOOT);
      } else {
        b.stop();
        this.phase = "wait";
      }
    } else if (this.phase === "wait") {
      b.stop();
      b.playClip(ANIMATION.SIT_LOOP);
      if (peer.peerYield.bridgeTravel) {
        const heading = this.#travelDirection(peer, this.direction);
        const normal = new b.pc.Vec3(heading.z, 0, -heading.x);
        const relative = b.position.clone().sub(peer.position);
        const clearance = b.radius + peer.radius + 0.16;
        if (relative.dot(heading) > -clearance && Math.abs(relative.dot(normal)) < clearance - 0.02) {
          this.#request(peer, heading);
        }
      }
      const offset = peer.position.clone().sub(this.home);
      const clearance = b.radius + peer.radius + 0.18;
      // Do not return just because the passer paused beside us.
      if (this.phase === "wait" && (offset.dot(this.direction) > clearance || offset.length() > 2.5)) {
        this.phase = "return";
      }
    } else if (this.phase === "return") {
      if (b.position.distance(this.home) <= 0.06) {
        b.stop();
        this.cancel();
      } else if (b.clearPeerStep(this.home, peer)) {
        b.moveToward({ position: this.home }, 0.65, 0.04);
        b.playClip(ANIMATION.SCOOT);
      } else {
        b.stop();
        b.playClip(ANIMATION.SIT_LOOP);
      }
    }
    this.constrain();
  }

  /**
   * @param {import("./LatchSlug.js").LatchSlug} peer
   * @returns {boolean}
   */
  #corridorClear(peer) {
    const heading = this.#travelDirection(peer, this.direction);
    const normal = new this.owner.pc.Vec3(heading.z, 0, -heading.x);
    const clearance = this.owner.radius + peer.radius + 0.16;

    return Math.abs(this.owner.position.clone().sub(peer.position).dot(normal)) >= clearance;
  }

  cancel() {
    if (this.receiver?.peerYield.requester === this.owner) {
      this.receiver.peerYield.phase = "return";
    }
    if (this.requester?.peerYield.receiver === this.owner) {
      this.requester.peerYield.receiver = null;
    }
    this.receiver = null;
    this.requester = null;
    this.phase = "";
    this.bridgePassage = false;
  }
}
