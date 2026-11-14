/**
 * @typedef {object} BridgeGelLoad
 * @property {number} compression
 * @property {number} bounce
 * @property {number} along
 * @property {number} across
 */

/**
 * Contact-driven artwork only. The grounded flag comes from the hero's Ammo
 * support resolution; terrain collision and navigation retain their stable deck.
 * A short authored ringdown is evaluated analytically, never integrated as a
 * second physical simulation alongside Ammo.
 */
export class BridgeGelReaction {
  /**
   * @type {number}
   */
  #time = 0;
  /**
   * @type {import("playcanvas").Vec3|null}
   */
  #previous = null;
  /**
   * @type {boolean}
   */
  #supported = false;
  /**
   * @type {number}
   */
  #distance = 0;
  /**
   * @type {Array<{station:number,time:number,strength:number}>}
   */
  #pulses = [];

  /**
   * @param {number} deltaTime
   * @param {{position:import("../ObjectTypes.js").Point3,grounded:boolean}|null} walker
   * @param {{span:import("../ObjectTypes.js").MapObjectDefinition["span"], stationPosition:(station:number)=>import("playcanvas").Vec3}} bridge
   * @returns {Map<number, BridgeGelLoad>}
   */
  update(deltaTime, walker, bridge) {
    this.#time += Math.max(0, deltaTime);
    const loads = new Map();
    const { span, stationPosition } = bridge;
    const center = stationPosition(span.start);
    const position = walker?.position;
    const along = position ? span.start + (span.horizontal ? position.x - center.x : position.z - center.z) : Infinity;
    const across = position ? (span.horizontal ? position.z - center.z : position.x - center.x) : Infinity;
    const surface = stationPosition(Math.max(span.start, Math.min(span.end, along)));
    const supported = Boolean(walker?.grounded && Math.abs(across) < 0.96 &&
      along >= span.start - 0.5 && along <= span.end + 0.5 && Math.abs(position.y - surface.y) < 0.18);
    if (supported) {
      let distance = this.#previous ? Math.hypot(position.x - this.#previous.x, position.z - this.#previous.z) : 0;
      // Teleports must not synthesize a string of footsteps.
      if (distance > 0.8) {
        distance = 0;
      }
      this.#distance += distance;
      if (!this.#supported || this.#distance >= 0.36) {
        this.#pulses.push({
          station: Math.round(along),
          time: this.#time,
          strength: this.#supported ? 0.65 : 1,
        });
        this.#distance %= 0.36;
      }
      for (let station = span.start; station <= span.end; station++) {
        const weight = Math.max(0, 1 - Math.abs(station - along) / 1.05);
        if (weight > 0) {
          loads.set(station, {
            compression: weight * 0.7,
            bounce: 0,
            along: Math.max(-1, Math.min(1, (along - station) * 2)),
            across: Math.max(-1, Math.min(1, across)),
          });
        }
      }
    } else {
      this.#distance = 0;
      if (this.#supported && this.#previous) {
        const previousAlong = span.start + (span.horizontal ? this.#previous.x - center.x : this.#previous.z - center.z);
        this.#pulses.push({
          station: Math.round(previousAlong),
          time: this.#time,
          strength: -0.45,
        });
      }
    }
    this.#previous = position ? center.clone().set(position.x, position.y, position.z) : null;
    this.#supported = supported;
    for (const pulse of this.#pulses) {
      const age = this.#time - pulse.time;
      if (age >= 0.85) {
        continue;
      }
      for (let station = Math.max(span.start, pulse.station - 1); station <= Math.min(span.end, pulse.station + 1); station++) {
        const delay = Math.abs(station - pulse.station) * 0.09;
        const phase = age - delay;
        if (phase < 0) {
          continue;
        }
        const strength = pulse.strength * (station === pulse.station ? 1 : 0.3);
        const bounce = -Math.cos(phase * 18) * Math.exp(-phase * 6) * strength;
        const load = loads.get(station) ?? {
          compression: 0,
          bounce: 0,
          along: 0,
          across: 0,
        };
        load.compression = Math.min(1, load.compression + Math.max(0, -bounce) * 0.3);
        load.bounce = Math.max(-1, Math.min(1, load.bounce + bounce));
        loads.set(station, load);
      }
    }
    this.#pulses = this.#pulses.filter(this.#retainPulse.bind(this));

    return loads;
  }

  /**
   * @param {{time:number}} pulse
   * @returns {boolean}
   */
  #retainPulse(pulse) {
    return this.#time - pulse.time < 0.85;
  }
}
