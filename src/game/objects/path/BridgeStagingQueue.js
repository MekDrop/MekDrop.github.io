/**
 * A bank waiting place remains separate from physical construction reservations.
 */
export class BridgeStagingQueue {
  /**
   * @type {Map<number,import("../enemies/latch-slug/LatchSlug.js").LatchSlug>}
   */
  #owners = new Map();

  /**
   * @param {number} direction
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @returns {boolean}
   */
  canPromote(direction, slug) {
    const owner = this.#owners.get(direction);

    return !owner || owner === slug;
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   * @param {{span:import("../ObjectTypes.js").MapObjectDefinition["span"],stationPosition:(station:number)=>import("playcanvas").Vec3,isReady:(station:number)=>boolean,reservationOwner:(station:number)=>import("../enemies/latch-slug/LatchSlug.js").LatchSlug|undefined}} context
   * @returns {{station:number,position:import("playcanvas").Vec3,approach:import("playcanvas").Vec3,staging:boolean,direction:number}|null}
   */
  reserve(slug, { span, stationPosition, isReady, reservationOwner }) {
    const center = stationPosition((span.start + span.end) / 2);
    const direction = (span.horizontal ? slug.position.x <= center.x : slug.position.z <= center.z) ? -1 : 1;
    const owner = this.#owners.get(direction);
    const bank = stationPosition(direction < 0 ? span.start - 1 : span.end + 1);
    if ((owner && owner !== slug) || Math.abs(slug.position.y - bank.y) > 0.65) {
      return null;
    }
    let station = direction < 0 ? span.start : span.end;
    while (station >= span.start && station <= span.end && isReady(station)) {
      station -= direction;
    }
    if (station < span.start || station > span.end || reservationOwner(station) === slug) {
      return null;
    }
    const approach = bank.clone();
    if (span.horizontal) {
      approach.x += direction * 1.9;
    } else {
      approach.z += direction * 1.9;
    }
    this.release(slug);
    this.#owners.set(direction, slug);

    return {
      station,
      position: stationPosition(station),
      approach,
      staging: true,
      direction,
    };
  }

  /**
   * @param {import("../enemies/latch-slug/LatchSlug.js").LatchSlug} slug
   */
  release(slug) {
    for (const [direction, owner] of this.#owners) {
      if (owner === slug) {
        this.#owners.delete(direction);
      }
    }
  }

  clear() {
    this.#owners.clear();
  }
}
