import { SLIME_BRIDGE_GROWTH_SECONDS, slimeBridgeTransferProgress } from "./BridgeSlimeTiming.js";

/**
 * Temporary living identities in the bank reservoir. The pool never consumes a
 * worker: its original actor owns both the outward and the inverse transfer.
 */
export class BridgeCounterweightPool {
  /**
   * @type {Map<import("../enemies/latch-slug/LatchSlug.js").LatchSlug,{direction:number,station:number,position:import("playcanvas").Vec3,approach:import("playcanvas").Vec3,age:number,status:string,admitted:boolean}>}
   */
  #donors = new Map();
  /**
   * @type {number}
   */
  #releaseDelay = 0;

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @returns {ReturnType<BridgeCounterweightPool["reserve"]>}
   */
  assignment(owner) {
    const donor = this.#donors.get(owner);

    return donor && donor.status !== "failed" ? {
      ...donor,
      counterweight: true,
    } : null;
  }

  /**
   * @param {number} direction
   * @returns {number}
   */
  count(direction) {
    let count = 0;
    for (const donor of this.#donors.values()) {
      count += Number(donor.direction === direction && donor.status !== "failed");
    }

    return count;
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @param {number} direction
   * @param {number} station
   * @param {import("playcanvas").Vec3} position
   * @param {boolean} horizontal
   * @returns {{station:number,direction:number,position:import("playcanvas").Vec3,approach:import("playcanvas").Vec3,counterweight:boolean}}
   */
  reserve(owner, direction, station, position, horizontal) {
    const approach = position.clone();
    approach[horizontal ? "x" : "z"] += direction * 0.95;
    const donor = {
      direction,
      station,
      position,
      approach,
      feedApproach: approach.clone(),
      age: 0,
      status: "reserved",
      admitted: false,
    };
    this.#donors.set(owner, donor);

    return {
      ...donor,
      counterweight: true,
    };
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @returns {boolean}
   */
  begin(owner) {
    const donor = this.#donors.get(owner);
    if (!donor || donor.status !== "reserved") {
      return false;
    }
    donor.status = "growing";

    return true;
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @returns {string|null}
   */
  status(owner) {
    return this.#donors.get(owner)?.status ?? null;
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @returns {{progress:number,nativeAdmitted:boolean}|null}
   */
  morph(owner) {
    const donor = this.#donors.get(owner);

    return donor ? {
      progress: donor.admitted ? 1 : Math.min(0.999, slimeBridgeTransferProgress(donor.age)),
      nativeAdmitted: donor.admitted,
    } : null;
  }

  /**
   * @returns {Map<number,number>}
   */
  get masses() {
    const masses = new Map();
    for (const donor of this.#donors.values()) {
      if (donor.admitted && donor.status !== "failed") {
        masses.set(donor.station, (masses.get(donor.station) ?? 0) + 1);
      }
    }

    return masses;
  }

  /**
   * @returns {Array<{id:import("../enemies/latch-slug/LatchSlug.js").LatchSlug,station:number,source:import("playcanvas").Vec3,progress:number}>}
   */
  get transfers() {
    const transfers = [];
    for (const [owner, donor] of this.#donors) {
      if (donor.status === "growing" && !donor.admitted || donor.status === "failed" && donor.admitted && donor.age < 0.7) {
        transfers.push({
          id: owner,
          station: donor.station,
          source: owner.position.clone(),
          progress: donor.status === "failed" ? 1 - slimeBridgeTransferProgress(donor.age / 0.7 * SLIME_BRIDGE_GROWTH_SECONDS) : this.morph(owner).progress,
        });
      }
    }

    return transfers;
  }

  /**
   * Admission/removal happen at the same native handoff as ordinary bridge gel.
   * Native mass never includes an approaching or merely reserved contributor.
   * @param {number} dt
   * @param {import("./Bridge.js").Bridge} bridge
   * @param {(direction:number)=>number} required
   * @param {(owner:import("../enemies/latch-slug/LatchSlug.js").LatchSlug,station:number)=>boolean} canRelease
   * @returns {boolean}
   */
  update(dt, bridge, required, canRelease = () => true) {
    let changed = false;
    this.#releaseDelay = Math.max(0, this.#releaseDelay - Math.max(0, dt));
    for (const donor of this.#donors.values()) {
      if (donor.status === "failed") {
        donor.age += Math.max(0, dt);
      }
    }
    for (const direction of [-1, 1]) {
      let excess = this.count(direction) - required(direction);
      const donors = [...this.#donors].reverse();
      for (const [owner, donor] of donors) {
        if (donor.direction !== direction || donor.status === "failed") {
          continue;
        }
        if (excess > 0) {
          if (donor.admitted && this.#releaseDelay > 0) {
            continue;
          }
          if (donor.admitted && !canRelease(owner, donor.station)) {
            continue;
          }
          if (donor.admitted) {
            // Reconstituted native capsules need room to leave the liquid lip.
            // Remove exactly one actual unit at each handoff; retaining the
            // other units in Ammo avoids overlapping several full bodies.
            this.#releaseDelay = 0.9;
          }
          donor.status = "failed";
          donor.age = 0;
          excess--;
          changed ||= donor.admitted;
          continue;
        }
        if (donor.status === "growing") {
          donor.age += Math.max(0, dt);
          if (donor.age >= SLIME_BRIDGE_GROWTH_SECONDS) {
            if (owner.beginBridgeMaterialValidation?.(bridge, donor.station) === false) {
              donor.status = "failed";
              continue;
            }
            donor.admitted = true;
            donor.status = "complete";
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} owner
   * @returns {boolean}
   */
  release(owner) {
    const admitted = this.#donors.get(owner)?.admitted ?? false;
    this.#donors.delete(owner);

    return admitted;
  }

  /**
   * @returns {IterableIterator<[import("../enemies/latch-slug/LatchSlug.js").LatchSlug,{station:number,approach:import("playcanvas").Vec3}]>}
   */
  get entries() {
    return this.#donors.entries();
  }
}
