/**
 * Body travel shared with the authored planted-foot transfer clips.
 * @param {number} phase
 * @returns {number}
 */
export function ladderTransferOffset(phase) {
  const stages = [[0, 0], [0.18, 0], [0.55, 0.4375], [0.7, 0.8125], [0.85, 1], [1, 1]];
  for (let index = 1; index < stages.length; index++) {
    const [end, value] = stages[index], [start, previous] = stages[index - 1];
    if (phase <= end) {
      const t = Math.max(0, (phase - start) / (end - start));

      return previous + (value - previous) * t * t * (3 - 2 * t);
    }
  }

  return 1;
}

/**
 * Recover the contact pose from the capsule's actual sideways travel.
 * @param {number} offset
 * @returns {number}
 */
function transferPosePhase(offset) {
  const stages = [[0.18, 0], [0.55, 0.4375], [0.7, 0.8125], [0.85, 1]];
  for (let index = 1; index < stages.length; index++) {
    const [end, value] = stages[index], [start, previous] = stages[index - 1];
    if (offset <= value) {
      const t = Math.max(0, Math.min(1, (offset - previous) / (value - previous)));
      const inverse = 0.5 - Math.sin(Math.asin(1 - 2 * t) / 3);

      return start + (end - start) * inverse;
    }
  }

  return 0.85;
}

/**
 * @param {number} phase
 * @returns {number}
 */
function transferBackOffset(phase) {
  const t = Math.max(0, Math.min(1, (phase - 0.4) / 0.3));

  return t * t * (3 - 2 * t);
}

/**
 * Movement-driven ladder attachment; the dynamic hero body remains in Ammo.
 */
export class HeroLadderClimb {
  /**
   * @type {Set<import("../architecture/ladder/Ladder.js").Ladder>}
   */
  #ladders = new Set();
  /**
   * @type {import("../architecture/ladder/Ladder.js").Ladder|null}
   */
  #active = null;
  /**
   * @type {{x:number,y:number,z:number}|null}
   */
  #exitLanding = null;
  /**
   * @type {boolean}
   */
  #exiting = false;
  /**
   * @type {boolean}
   */
  #mounting = false;
  /**
   * @type {number}
   */
  #transferPhase = 0;
  /**
   * @type {number}
   */
  #travelSign = 1;
  /**
   * @type {number}
   */
  #lastTravelDirection = 1;
  /**
   * @type {{x:number,z:number}|null}
   */
  #controlFacing = null;
  /**
   * @type {number}
   */
  #cooldown = 0;
  /**
   * @type {boolean}
   */
  #needsRelease = false;

  /**
   * @param {import("../architecture/ladder/Ladder.js").Ladder} ladder
   */
  register(ladder) {
    this.#ladders.add(ladder);

    return () => {
      this.#ladders.delete(ladder);
      if (this.#active === ladder) this.reset();
    };
  }

  reset() { this.#active = null; this.#exitLanding = null; this.#exiting = false; this.#mounting = false; this.#transferPhase = 0; this.#cooldown = 0.4; this.#needsRelease = true; }

  /**
   * @param {number} deltaTime
   * @param {{position: {x:number,y:number,z:number}, input: {x:number,y:number}, movement: {x:number,z:number}|null, jump:boolean, allowed:boolean, grounded?:boolean}} options
   */
  update(deltaTime, { position, input, movement, jump, allowed, grounded = false }) {
    this.#cooldown = Math.max(0, this.#cooldown - deltaTime);
    if (Math.hypot(input.x, input.y) < 0.1) this.#needsRelease = false;
    const lateral = this.#active && movement && Math.abs(movement.x * this.#controlFacing.x + movement.z * this.#controlFacing.z) < 0.25;
    const atTop = this.#active && position.y >= this.#active.landing("top").y - 0.1;
    if (!allowed || jump || (lateral && !atTop)) {
      if (this.#active) this.reset();
      return null;
    }
    if (!this.#active && !this.#needsRelease && this.#cooldown === 0 && movement) {
      for (const ladder of this.#ladders) {
        const bottom = ladder.landing("bottom");
        const top = [...(ladder.topLandings ?? [ladder.landing("top")])].sort(/**
         *
         * @param {{x:number,z:number}} a
         * @param {{x:number,z:number}} b
         */
          (a, b) =>
            Math.hypot(position.x - a.x, position.z - a.z) - Math.hypot(position.x - b.x, position.z - b.z))[0];
        const facing = ladder.climbFacing;
        const toward = movement.x * facing.x + movement.z * facing.z;
        const guide = ladder.climbGuide?.(top.y) ?? bottom;
        const approachLength = Math.hypot(guide.x - top.x, guide.z - top.z) || 1;
        const roofFacing = {
          x: (guide.x - top.x) / approachLength,
          z: (guide.z - top.z) / approachLength,
        };
        const towardRoof = movement.x * roofFacing.x + movement.z * roofFacing.z;
        const lower = Math.abs(position.y - bottom.y) < 0.55 && Math.hypot(position.x - bottom.x, position.z - bottom.z) < 0.6 && toward > 0.25;
        const upper = Math.abs(position.y - top.y) < 0.4 && Math.hypot(position.x - top.x, position.z - top.z) < 0.7 && towardRoof > 0.25;
        if (lower || upper) { this.#active = ladder; this.#exitLanding = upper ? top : null; this.#mounting = upper; this.#transferPhase = upper ? 1 : 0; this.#travelSign = upper ? -1 : 1; this.#lastTravelDirection = this.#travelSign; this.#controlFacing = upper ? roofFacing : facing; break; }
      }
    }
    if (!this.#active) return null;
    const ladder = this.#active;
    const bottom = ladder.landing("bottom");
    const landings = ladder.topLandings ?? [ladder.landing("top")];
    if (!this.#exitLanding || (lateral && atTop && this.#transferPhase <= 0.18)) {
      this.#exitLanding = [...landings].sort(/**
       *
       * @param {{x:number,z:number}} a
       * @param {{x:number,z:number}} b
       */
        (a, b) => {
          return movement ? (b.x - a.x) * movement.x + (b.z - a.z) * movement.z : 0;
        })[0];
    }
    const top = this.#exitLanding;
    const facing = this.#controlFacing;
    let speed = movement ? (movement.x * facing.x + movement.z * facing.z) * this.#travelSign : 0;
    if (lateral && atTop && this.#travelSign > 0) speed = 1;
    if (Math.abs(speed) > 0.1) this.#lastTravelDirection = Math.sign(speed);
    // Finish crossing the roof slab after input release. Pausing is safe only
    // once the whole body is below the opening, or standing on the landing.
    if (!movement && position.y > top.y - 1.6) speed = this.#lastTravelDirection;
    if (position.y >= top.y - 0.08 && (speed > 0 || lateral)) this.#exiting = true;
    ladder.openHatch();
    const nextHeight = Math.min(top.y, Math.max(bottom.y, position.y + speed * 1.5 * deltaTime));
    const guide = ladder.climbGuide?.(nextHeight) ?? {
      ...bottom,
      y: nextHeight,
    };
    let target = guide;
    const roofGuide = ladder.climbGuide?.(top.y) ?? {
      ...bottom,
      y: top.y,
    };
    const climbFacing = ladder.climbFacing;
    const axial = (top.x - roofGuide.x) * climbFacing.x + (top.z - roofGuide.z) * climbFacing.z;
    const sideX = top.x - roofGuide.x - axial * climbFacing.x;
    const sideZ = top.z - roofGuide.z - axial * climbFacing.z;
    const hasSideExit = Math.hypot(sideX, sideZ) > 0.1;
    const backX = hasSideExit ? axial * climbFacing.x : 0;
    const backZ = hasSideExit ? axial * climbFacing.z : 0;
    const travelX = hasSideExit ? sideX : top.x - roofGuide.x;
    const travelZ = hasSideExit ? sideZ : top.z - roofGuide.z;
    const stepTime = Math.max(deltaTime, 0.00001);
    let horizontalLimit = 2, gain = 8;
    if (this.#exiting || this.#mounting) {
      const previous = ladderTransferOffset(this.#transferPhase);
      const previousBack = transferBackOffset(this.#transferPhase);
      const expectedX = roofGuide.x + travelX * previous + backX * previousBack;
      const expectedZ = roofGuide.z + travelZ * previous + backZ * previousBack;
      if (Math.hypot(position.x - expectedX, position.z - expectedZ) < 0.1) {
        this.#transferPhase = Math.max(0, Math.min(1, this.#transferPhase + Math.sign(speed) * deltaTime / 2.2));
      }
      const offset = ladderTransferOffset(this.#transferPhase);
      const back = transferBackOffset(this.#transferPhase);
      target = {
        x: roofGuide.x + travelX * offset + backX * back,
        y: top.y,
        z: roofGuide.z + travelZ * offset + backZ * back,
      };
      // A bounded response stays stable when rendering and Ammo use different
      // timesteps; the contact pose follows the actual capsule position.
      horizontalLimit = 1.4; gain = 8;
      if (this.#transferPhase === 0 && speed < 0) { this.#mounting = false; this.#exiting = false; }
    }
    const landingDistance = Math.hypot(position.x - top.x, position.z - top.z);
    // Contact owns the landing height: masonry and collision margins can put
    // the feet above the authored floor coordinate.
    const landed = this.#exiting && this.#transferPhase === 1 && landingDistance < 0.08 && grounded && position.y >= top.y - 0.1;
    const outsideLadder = position.y > top.y + 0.55 || position.y < bottom.y - 0.55 ||
      Math.min(landingDistance, Math.hypot(position.x - guide.x, position.z - guide.z)) > 1;
    if (landed || outsideLadder || (!this.#exiting && !this.#mounting && speed < 0 && position.y <= bottom.y + 0.025)) {
      this.reset();

      return null;
    }
    // Roof collision supports the capsule while approaching the opening. Once
    // that support ends, descend immediately rather than holding it in midair.
    const verticalSpeed = this.#exiting || this.#mounting
      ? Math.max(-1.5, Math.min(1.5, (top.y - position.y) * 8))
      : speed * 1.5;
    // Clamp the velocity as well as the guide. Otherwise the Ammo body keeps
    // moving beyond the endpoint even though its horizontal guide has stopped.
    const pauseHeight = !movement && this.#lastTravelDirection < 0 && position.y > top.y - 1.6
      ? Math.max(bottom.y, top.y - 1.6) : bottom.y;
    const boundedVerticalSpeed = Math.max(
      Math.min(0, (pauseHeight - position.y) / stepTime),
      Math.min(verticalSpeed, Math.max(0, (top.y - position.y) / stepTime)),
    );
    const heightProgress = Math.max(0, Math.min(1, (position.y - (top.y - 0.9)) / 0.9));
    const exitX = top.x - roofGuide.x, exitZ = top.z - roofGuide.z;
    const actualOffset = Math.max(0, Math.min(1, ((position.x - roofGuide.x) * travelX + (position.z - roofGuide.z) * travelZ) / (travelX * travelX + travelZ * travelZ || 1)));
    let posePhase = this.#transferPhase;
    if ((posePhase > 0.18 && posePhase < 0.85) || (posePhase >= 0.85 && actualOffset < 0.998) || (posePhase <= 0.18 && actualOffset > 0.002)) {
      posePhase = transferPosePhase(actualOffset);
    }
    const topSide = Math.sign(exitX * climbFacing.z - exitZ * climbFacing.x);
    const turn = Math.max(0, Math.min(1, (posePhase - 0.7) / 0.15));
    const angle = topSide * Math.PI / 2 * turn * turn * (3 - 2 * turn);
    const transferFacing = {
      x: climbFacing.x * Math.cos(angle) + climbFacing.z * Math.sin(angle),
      z: climbFacing.z * Math.cos(angle) - climbFacing.x * Math.sin(angle),
    };
    const poseOffset = ladderTransferOffset(posePhase), poseBack = transferBackOffset(posePhase);
    const transferring = this.#exiting || this.#mounting;
    const rootCorrection = transferring ? {
      x: Math.max(-0.08, Math.min(0.08, roofGuide.x + travelX * poseOffset + backX * poseBack - position.x)),
      z: Math.max(-0.08, Math.min(0.08, roofGuide.z + travelZ * poseOffset + backZ * poseBack - position.z)),
    } : {
      x: 0,
      z: 0,
    };

    return {
      velocity: {
        x: Math.max(-horizontalLimit, Math.min(horizontalLimit, (target.x - position.x) * gain)),
        y: boundedVerticalSpeed,
        z: Math.max(-horizontalLimit, Math.min(horizontalLimit, (target.z - position.z) * gain)),
      },
      facing: this.#exiting || this.#mounting ? transferFacing : climbFacing,
      topSide,
      rootCorrection,
      topProgress: this.#exiting || this.#mounting ? 0.4 + 0.6 * posePhase : heightProgress * 0.4,
      speed: this.#exiting ? 1 : Math.abs(speed),
    };
  }
}
