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
      && ["LatchSeekState", "LatchDogState", "LatchAnnoyedState"].includes(b.stateName);
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
      if (peer === b || !peer.peerYield || !peer.alive || peer.carrier || peer.airborne
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
      if (b.annoyance.active && peer.peerYield.available && !this.receiver && !this.requester
        && !peer.annoyance.active && !peer.peerYield.requester && !peer.peerYield.receiver) {
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
    const home = b.position.clone();
    for (const sign of [-1, 1]) {
      const aside = home.clone().add(new b.pc.Vec3(direction.z, 0, -direction.x)
        .mulScalar(sign * (b.radius + requester.radius + 0.16)));
      if (!b.clearPeerStep(aside, requester)) {
        continue;
      }
      this.requester = requester;
      requester.peerYield.receiver = b;
      this.home = home;
      this.aside = aside;
      this.direction = direction.clone();
      this.age = 0;
      this.phase = "notice";
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
    if (!peer.peerYield.available || !peer.annoyance.active) {
      this.phase = "return";
    }
    if (this.phase === "notice") {
      b.stop();
      b.playClip(this.age < 0.3 ? ANIMATION.STARTLED : ANIMATION.TURN);
      if (this.age >= 0.7 && b.pack.canSee(peer)) {
        this.phase = "aside";
      }
    } else if (this.phase === "aside") {
      if (!b.clearPeerStep(this.aside, peer)) {
        b.stop();
      } else if (b.position.distance(this.aside) > 0.06) {
        b.moveToward({ position: this.aside }, 0.65, 0.04);
        b.playClip(ANIMATION.SCOOT);
      } else {
        b.stop();
        this.phase = "wait";
      }
    } else if (this.phase === "wait") {
      b.stop();
      b.playClip(ANIMATION.SIT_LOOP);
      const offset = peer.position.clone().sub(this.home);
      const clearance = b.radius + peer.radius + 0.18;
      // Do not return just because the passer paused beside us.
      if (offset.dot(this.direction) > clearance || offset.length() > 2.5) {
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
  }
}
