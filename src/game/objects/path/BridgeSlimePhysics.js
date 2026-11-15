import { BridgeSlimeTruss } from "./BridgeSlimeTruss.js";
import { BridgeSlimeSections } from "./BridgeSlimeSections.js";
import { ACTOR_MASS } from "../../enum/ActorMass.js";

/**
 * Articulated living mass in the game's Ammo world. Point joints preserve the
 * connected volume; gravity and real terrain contacts decide where a free tip
 * hangs. Reshaping uses bounded forces, never transform-driven falling motion.
 */
export class BridgeSlimePhysics {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {BridgeSlimeTruss}
   */
  #truss;
  /**
   * @type {BridgeSlimeSections}
   */
  #sections;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {boolean}
   */
  #horizontal;
  /**
   * @type {Map<number, {entity:import("playcanvas").Entity,target:import("playcanvas").Vec3}>}
   */
  #bodies = new Map();
  /**
   * @type {import("sync-ammo/dist/ammo").btPoint2PointConstraint[]}
   */
  #joints = [];
  /**
   * @type {string}
   */
  #signature = "";
  /**
   * @type {boolean}
   */
  #connected = false;
  /**
   * @type {boolean}
   */
  #settled = false;
  /**
   * @type {Map<number,number>}
   */
  #volumes = new Map();
  /**
   * @type {boolean}
   */
  #materialComplete = false;
  /**
   * @type {(station:number)=>boolean}
   */
  #supported = () => false;
  /**
   * @type {Set<string>}
   */
  #banks = new Set();
  /**
   * @type {Set<number>}
   */
  #links = new Set();
  /**
   * @type {number}
   */
  #reachAge = 0;
  /**
   * @type {Map<number,number>}
   */
  #stressAge = new Map();
  /**
   * @type {Set<number>}
   */
  #failedStations = new Set();
  /**
   * @type {Map<number,number>}
   */
  #attempts = new Map();
  /**
   * @type {Map<number,number>}
   */
  #profiles = new Map();
  /**
   * @type {Map<number,number>}
   */
  #anticipatedLoads = new Map();
  /**
   * @type {Map<number,number>}
   */
  #poolMasses = new Map();
  /**
   * @type {boolean}
   */
  #supportPending = false;
  /**
   * @type {number}
   */
  #supportGraceAge = 0;
  /**
   * @type {number}
   */
  #permanentCount = 0;
  /**
   * @type {number}
   */
  #preparation = 0;
  /**
   * @type {Map<number,{volume:number,profile:number}>}
   */
  #preparationStarts = new Map();
  /**
   * @type {Map<number,number>}
   */
  #flowDirections = new Map();
  /**
   * @type {Map<number,{index:number,count:number}>}
   */
  #components = new Map();

  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application,root:import("playcanvas").Entity,horizontal:boolean}} options
   */
  constructor({ pc, app, root, horizontal }) {
    this.#pc = pc;
    this.#app = app;
    this.#horizontal = horizontal;
    this.#truss = new BridgeSlimeTruss(pc, app, horizontal);
    this.#sections = new BridgeSlimeSections(pc, app);
  }

  /**
   * Material admission is independent of navigation admission.
   * @param {Map<number, import("playcanvas").Vec3>} stations
   * @param {(station:number)=>boolean} supported
   * @param {boolean} connected
   * @param {Map<number,number>} failures
   * @param {Map<number,number>} anticipatedLoads Existing front station to outgoing map direction.
   * @param {Map<number,number>} poolMasses Bank reservoir stations to actual admitted donor units.
   * @param {boolean} supportPending Additional bank donor units are still required.
   */
  sync(stations, supported, connected, failures = new Map(), anticipatedLoads = new Map(), poolMasses = new Map(), supportPending = false) {
    const ammo = globalThis.Ammo;
    if (!ammo?.btPoint2PointConstraint || !this.#app.systems?.rigidbody?.dynamicsWorld) {
      return;
    }
    const anchors = [...stations.keys()].map(/**
     *
     * @param {number} station
     */
      (station) => `${station}:${stations.get(station).toString()}:${Number(supported(station - 1))}:${Number(supported(station + 1))}`);
    const signature = `${anchors.join(",")}:${connected}:${JSON.stringify([...failures])}:${JSON.stringify([...anticipatedLoads])}:${JSON.stringify([...poolMasses])}`;
    const frontChanged = JSON.stringify([...anticipatedLoads]) !== JSON.stringify([...this.#anticipatedLoads]);
    const materialChanged = stations.size !== this.#bodies.size || JSON.stringify([...poolMasses]) !== JSON.stringify([...this.#poolMasses]);
    if (!connected && anticipatedLoads.size > 0 && (frontChanged || materialChanged)) {
      this.#preparationStarts = new Map();
      for (const station of stations.keys()) {
        this.#preparationStarts.set(station, {
          volume: this.#volumes.get(station) ?? 1,
          profile: this.#profiles.get(station) ?? 1,
        });
      }
      this.#preparation = 0;
    }
    const permanentCount = stations.size - poolMasses.size;
    if (permanentCount !== this.#permanentCount) {
      this.#supportGraceAge = 0;
      this.#permanentCount = permanentCount;
    }
    this.#supportPending = supportPending;
    this.#poolMasses = new Map(poolMasses);
    this.#attempts = new Map(failures);
    this.#anticipatedLoads = new Map(anticipatedLoads);
    if (connected || stations.size === 0) {
      this.#preparation = 0;
      this.#preparationStarts.clear();
    }
    this.#materialComplete = connected;
    this.#supported = supported;
    if (signature === this.#signature) {
      return;
    }
    this.#signature = signature;
    this.#reachAge = 0;
    this.#clearJoints();
    for (const [station, entry] of this.#bodies) {
      if (!stations.has(station)) {
        this.#sections.release(entry.entity);
        this.#app.fire?.("bridge-slime:before-body-change", entry.entity, "destroy");
        entry.entity.destroy();
        this.#bodies.delete(station);
        this.#volumes.delete(station);
        this.#profiles.delete(station);
        this.#stressAge.delete(station);
        this.#failedStations.delete(station);
        this.#banks.delete(`${station}:-1`);
        this.#banks.delete(`${station}:1`);
        this.#links.delete(station - 1);
        this.#links.delete(station);
      }
    }
    for (const [station, target] of stations) {
      if (this.#bodies.has(station)) {
        this.#bodies.get(station).target.copy(target);
        continue;
      }
      const entity = new this.#pc.Entity(`Living bridge physical mass ${station}`);
      this.#app.root.addChild(entity);
      const previous = this.#bodies.get(station - 1);
      const following = this.#bodies.get(station + 1);
      const neighbor = previous ?? following;
      if (poolMasses.has(station)) {
        entity.setPosition(target.x, target.y - 0.13, target.z);
      } else if (neighbor) {
        const direction = previous ? 1 : -1;
        const origin = neighbor.entity.getWorldTransform().transformPoint(new this.#pc.Vec3(
          this.#horizontal ? direction : 0, 0, this.#horizontal ? 0 : direction,
        ));
        const edge = this.#edge(neighbor.entity, direction);
        const groundPose = this.#groundContinuation(edge, direction, target.y);
        if (groundPose && origin.y - 0.13 < groundPose.groundHeight) {
          // Newly donated material turns along the contacted ground instead of
          // extending the old tip's downward tangent through the floor.
          entity.setPosition(groundPose.position);
          const angle = Math.asin(groundPose.slope) * 180 / Math.PI;
          entity.setEulerAngles(this.#horizontal ? 0 : -direction * angle, 0, this.#horizontal ? direction * angle : 0);
        } else {
          entity.setPosition(origin);
          entity.setRotation(neighbor.entity.getRotation());
        }
      } else {
        entity.setPosition(target.x, target.y - 0.13, target.z);
      }
      if (!poolMasses.has(station)) {
        entity.tags.add("hero-moving-support", "hero-support-surface", "capsule-support");
      }
      entity.addComponent("collision", {
        type: "box",
        halfExtents: new this.#pc.Vec3(this.#horizontal ? 0.5 : 0.94, 0.13, this.#horizontal ? 0.94 : 0.5),
      });
      entity.addComponent("rigidbody", {
        type: "dynamic",
        mass: ACTOR_MASS.LATCH_SLUG,
        friction: 0.85,
        restitution: 0.02,
        linearDamping: 0.65,
        angularDamping: 0.8,
        // Reservoir gel wets the bank contact patch, just like the bridge's
        // adhesive root. Its world pins transmit the finite native load; the
        // terrain collider must not eject that intentionally embedded patch.
        ...(poolMasses.has(station) ? { mask: this.#pc.BODYMASK_NOT_STATIC } : {}),
      });
      this.#bodies.set(station, {
        entity,
        target: target.clone(),
      });
    }
    this.#refreshAttachments();
    this.#truss.sync(this.#bodies, this.#links, this.#preparation, !this.#connected && this.#banks.size > 0, this.#banks);
    this.#redistribute(supported);
    this.#buildJoints();
  }

  /**
   * Sample the final ground-tangent footprint, excluding overhead surfaces and
   * vertical faces. Keep the donated body's near edge at the live tissue edge;
   * on a reachable step the continuation inclines instead of opening a gap.
   * @param {import("playcanvas").Vec3} edge
   * @param {number} direction
   * @param {number} deckHeight
   * @returns {{position:import("playcanvas").Vec3,slope:number,groundHeight:number}|null}
   */
  #groundContinuation(edge, direction, deckHeight) {
    let slope = 0;
    let found = false;
    let groundHeight = -Infinity;
    for (let iteration = 0; iteration < 3; iteration++) {
      const run = Math.sqrt(1 - slope * slope);
      let required = -0.85;
      for (const along of [0.5, 1]) {
        for (const across of [-0.78, 0, 0.78]) {
          const point = edge.clone().add(new this.#pc.Vec3(
            this.#horizontal ? direction * along * run : across, 0,
            this.#horizontal ? across : direction * along * run,
          ));
          const height = this.#groundHeight(point, Math.min(deckHeight, edge.y + 0.85));
          if (height === null) {
            continue;
          }
          found = true;
          groundHeight = Math.max(groundHeight, height);
          required = Math.max(required, (height + 0.13 - edge.y) / along);
        }
      }
      slope = Math.max(-0.85, Math.min(0.85, required));
    }
    if (!found) {
      return null;
    }
    const run = Math.sqrt(1 - slope * slope);

    return {
      position: edge.clone().add(new this.#pc.Vec3(
        this.#horizontal ? direction * run * 0.5 : 0, slope * 0.5,
        this.#horizontal ? 0 : direction * run * 0.5,
      )),
      slope,
      groundHeight,
    };
  }

  /**
   * @param {import("playcanvas").Vec3} point
   * @param {number} ceiling
   * @returns {number|null}
   */
  #groundHeight(point, ceiling) {
    const physics = this.#app.systems.rigidbody;
    const start = new this.#pc.Vec3(point.x, ceiling + 0.02, point.z);
    const end = new this.#pc.Vec3(point.x, ceiling - 32, point.z);
    const options = { filterCollisionMask: this.#pc.BODYGROUP_STATIC };
    const hits = physics.raycastAll?.(start, end, options) ?? [physics.raycastFirst?.(start, end, options)];
    let height = null;
    for (const hit of hits) {
      if (hit && hit.normal?.y >= 0.6 && hit.point.y <= ceiling + 0.001) {
        height = Math.max(height ?? -Infinity, hit.point.y);
      }
    }

    return height;
  }

  #buildJoints() {
    for (const [station, entry] of this.#bodies) {
      const next = this.#bodies.get(station + 1);
      if (next && this.#links.has(station)) {
        this.#join(entry.entity, next.entity, 1, null, this.#profiles.get(station));
      }
      if (this.#banks.has(`${station}:-1`)) {
        this.#join(entry.entity, null, -1, entry.target, this.#profiles.get(station));
      }
      if (this.#banks.has(`${station}:1`)) {
        this.#join(entry.entity, null, 1, entry.target, this.#profiles.get(station));
      }
    }
    this.#truss.buildJoints(this.#bodies);
  }

  /**
   * Pins and links are admitted only after their physical edges meet. Existing
   * links survive ordinary solver tolerance, but cannot outlive their material.
   * @returns {boolean}
   */
  #refreshAttachments() {
    let changed = false;
    let complete = this.#materialComplete && this.#bodies.size > 0;
    for (const [station, { entity, target }] of this.#bodies) {
      const next = this.#bodies.get(station + 1);
      if (next && !this.#links.has(station)) {
        if (this.#pairedEdgesMeet(entity, next.entity)) {
          this.#links.add(station);
          changed = true;
        }
      }
      if (next) {
        complete &&= this.#links.has(station);
      } else {
        this.#links.delete(station);
      }
      for (const direction of [-1, 1]) {
        const key = `${station}:${direction}`;
        const boundary = !this.#bodies.has(station + direction) || this.#poolMasses.has(station + direction);
        const eligible = boundary && (this.#poolMasses.has(station) ? this.#supported(station) && this.#poolBankContact(target) : this.#supported(station + direction));
        if (!eligible) {
          changed = this.#banks.delete(key) || changed;
          if (boundary) {
            complete = false;
          }
          continue;
        }
        // A bank attachment is an adhesive joint, not a proximity sensor.
        // A temporary load can stretch the solver or rotate the free tissue;
        // keep its real pin until the supporting bank or material disappears.
        if (!this.#banks.has(key) && this.#bankEdgesMeet(entity, direction, target)) {
          this.#banks.add(key);
          changed = true;
        }
        complete &&= this.#banks.has(key);
      }
    }
    if (complete !== this.#connected) {
      this.#connected = complete;
      changed = true;
    }
    return changed;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {number} direction
   * @returns {import("playcanvas").Vec3}
   */
  #edge(entity, direction) {
    return entity.getWorldTransform().transformPoint(new this.#pc.Vec3(
      this.#horizontal ? direction * 0.5 : 0, 0, this.#horizontal ? 0 : direction * 0.5,
    ));
  }

  /**
   * A reservoir is grounded on its own verified bank footprint. It does not
   * borrow support from another tile farther inland or from the missing span.
   * @param {import("playcanvas").Vec3} target
   * @returns {boolean}
   */
  #poolBankContact(target) {
    for (const along of [-0.4, 0.4]) {
      for (const across of [-0.75, 0.75]) {
        const point = target.clone().add(new this.#pc.Vec3(this.#horizontal ? along : across, 0, this.#horizontal ? across : along));
        const height = this.#groundHeight(point, target.y);
        if (height === null || Math.abs(height - target.y) > 0.1) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity} next
   * @returns {boolean}
   */
  #pairedEdgesMeet(entity, next) {
    for (const across of [-0.78, 0.78]) {
      const first = entity.getWorldTransform().transformPoint(new this.#pc.Vec3(
        this.#horizontal ? 0.5 : across, 0, this.#horizontal ? across : 0.5,
      ));
      const second = next.getWorldTransform().transformPoint(new this.#pc.Vec3(
        this.#horizontal ? -0.5 : across, 0, this.#horizontal ? across : -0.5,
      ));
      if (first.distance(second) >= 0.16) {
        return false;
      }
    }

    return true;
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {number} direction
   * @param {import("playcanvas").Vec3} target
   * @returns {boolean}
   */
  #bankEdgesMeet(entity, direction, target) {
    for (const across of [-0.78, 0.78]) {
      const local = new this.#pc.Vec3(this.#horizontal ? direction * 0.5 : across, 0, this.#horizontal ? across : direction * 0.5);
      const actual = entity.getWorldTransform().transformPoint(local);
      const bank = target.clone().add(local);
      bank.y -= 0.13;
      if (actual.distance(bank) >= 0.16) {
        return false;
      }
    }

    return true;
  }

  /**
   * Each contributor supplies one conserved volume unit. A free growth front
   * draws thin tissue from a thick bank reservoir; joining both anchors releases
   * that reservoir into the final even deck. Collider volume and body mass use
   * the same ratios as the artwork.
   * @param {(station:number)=>boolean} supported
   */
  #redistribute(supported) {
    const remaining = new Set(this.#bodies.keys());
    for (const station of this.#bodies.keys()) {
      if (!remaining.has(station)) {
        continue;
      }
      let first = station;
      let last = station;
      while (this.#bodies.has(first - 1) && this.#links.has(first - 1)) {
        first--;
      }
      while (this.#bodies.has(last + 1) && this.#links.has(last)) {
        last++;
      }
      let failures = 0;
      for (let index = first - 1; index <= last + 1; index++) {
        failures = Math.max(failures, this.#attempts.get(index) ?? 0);
      }
      const anchoredStart = this.#banks.has(first + ":-1");
      const anchoredEnd = this.#banks.has(last + ":1");
      // A failed construction strategy reforms as a deeper, narrower rib.
      // This moves existing gel, preserving cross-sectional area and mass.
      // Candidate admission moves the forecast to the incoming body before its
      // native contact necessarily joins this component. Preserve the same
      // physical flow interval on its predecessors instead of snapping their
      // geometry merely because the frontier is temporarily across that gap.
      const preparing = this.#anticipatedLoads.size > 0;
      // A forthcoming 12 kg contributor changes the shape before its contact.
      // Incoming load acts at the frontier: its bending moment grows with
      // reach even as the component gains mass. Never thin the support ribs
      // merely because another donor joined. No future mass enters the volume.
      const expectedLoad = preparing ? ACTOR_MASS.LATCH_SLUG / ((last - first + 1) * ACTOR_MASS.LATCH_SLUG) : 0;
      const preload = Math.min(0.75, expectedLoad * (last - first + 1) ** 2 * 0.5);
      const constructionDemand = Math.max(preload, Math.min(0.85, (last - first) * 0.2));
      const baseProfile = this.#connected ? 1 : 1 + Math.min(0.85, Math.min(3, failures) * 0.25 + constructionDemand);
      let direction = 0;
      for (let index = first; index <= last; index++) {
        direction ||= this.#anticipatedLoads.get(index) ?? 0;
      }
      direction = anchoredStart ? 1 : anchoredEnd ? -1 : 0;
      const trussVolume = this.#truss.allocate(first, last, ACTOR_MASS.LATCH_SLUG);
      let donorUnits = 0;
      for (let index = first; index <= last; index++) {
        donorUnits += this.#poolMasses.get(index) ?? 1;
      }
      const deckVolume = donorUnits - trussVolume;
      let reservedVolume = 0;
      const pooled = this.#poolMasses.has(first) || this.#poolMasses.has(last);
      if (pooled) {
        for (let index = first; index <= last; index++) {
          reservedVolume += this.#poolMasses.has(index) ? 0.5 : 1;
        }
      }
      const reserveScale = Math.min(1, deckVolume / Math.max(0.001, reservedVolume));
      reservedVolume *= reserveScale;
      const weights = new Map();
      let total = 0;
      let initialVolume = 0;
      for (let index = first; index <= last; index++) {
        const distance = direction > 0 ? index - first : last - index;
        const reach = last - first + 1 - distance;
        // A cantilever's root carries all downstream self weight and incoming
        // load. Allocate section area from that bending moment, monotonically
        // heavier toward the ACTUAL adhesive bank, never the free frontier.
        const moment = reach * reach * 0.5 + (preparing ? reach : 0);
        const weight = this.#connected || !direction ? 1 : moment ** (2 / 3);
        weights.set(index, weight);
        total += weight;
        initialVolume += this.#preparationStarts.get(index)?.volume ?? 1;
      }
      for (const [index, weight] of weights) {
        remaining.delete(index);
        const distance = direction > 0 ? index - first : last - index;
        // The adhesive root also needs a substantial material reservoir. Keep
        // a finite section at every front rather than starving its load path:
        // 30% forms the bank collar, 58% follows bending demand, and 12% remains
        // spread across the connected tissue. All shares use existing deck gel.
        const share = !this.#connected && direction
          ? 0.12 / weights.size + 0.58 * weight / total + (distance === 0 ? 0.3 : 0)
          : weight / total;
        // Once real temporary gel has arrived, permanent tiles retain viable
        // full sections. Only the excess forms bank ballast and reinforcement;
        // more donors must not simply scale an already-starved free tip.
        const minimumVolume = pooled ? (this.#poolMasses.has(index) ? 0.5 : 1) * reserveScale : 0;
        const targetVolume = minimumVolume + share * (deckVolume - reservedVolume);
        const anchorBias = direction && last > first ? 1 - distance / (last - first) : 1;
        // Removing material from a downstream rib must deepen it enough to
        // retain bending stiffness (I scales as area² * profile²). Otherwise
        // a dramatic reservoir would simply starve the worker's next support.
        const stiffnessProfile = Math.max(1, (weight / total) / share);
        const targetProfile = this.#poolMasses.has(index) ? 1.25 : this.#connected ? 1 :
          baseProfile * (1 + constructionDemand * 0.2 * anchorBias) * stiffnessProfile;
        const start = this.#preparationStarts.get(index);
        const progress = preparing && !this.#connected ? this.#preparation : 1;
        const previousVolume = (start?.volume ?? 1) / initialVolume * deckVolume;
        const volume = previousVolume + (targetVolume - previousVolume) * progress;
        const previousProfile = start?.profile ?? targetProfile;
        const profile = previousProfile + (targetProfile - previousProfile) * progress;
        this.#volumes.set(index, volume);
        this.#profiles.set(index, profile);
        this.#flowDirections.set(index, direction);
        this.#components.set(index, {
          index: direction < 0 ? last - index : index - first,
          count: last - first + 1,
        });
        const entity = this.#bodies.get(index).entity;
        this.#sections.release(entity);
        const scale = Math.sqrt(volume);
        if (entity.rigidbody.mass !== volume * ACTOR_MASS.LATCH_SLUG) {
          this.#app.fire?.("bridge-slime:before-body-change", entity, "replace");
          entity.rigidbody.mass = volume * ACTOR_MASS.LATCH_SLUG;
          this.#app.fire?.("bridge-slime:after-body-change", entity);
        }
        const halfExtents = new this.#pc.Vec3(
          this.#horizontal ? 0.5 : 0.94 * scale / profile, 0.13 * scale * profile, this.#horizontal ? 0.94 * scale / profile : 0.5,
        );
        if (!entity.collision.halfExtents.equals(halfExtents)) {
          const linear = entity.rigidbody.linearVelocity.clone();
          const angular = entity.rigidbody.angularVelocity.clone();
          this.#app.fire?.("bridge-slime:before-body-change", entity, "replace");
          entity.collision.halfExtents = halfExtents;
          entity.rigidbody.linearVelocity = linear;
          entity.rigidbody.angularVelocity = angular;
          this.#app.fire?.("bridge-slime:after-body-change", entity);
        }
        // Thin reshaped gel can accelerate quickly under an overload. Native
        // continuous collision keeps that finite failure on real terrain.
        entity.rigidbody.body.setCcdMotionThreshold?.(halfExtents.y);
        entity.rigidbody.body.setCcdSweptSphereRadius?.(halfExtents.y * 0.8);
        this.#sections.configure(entity, this.#horizontal, this.#connected ? 0 : direction,
          this.#connected ? 0 : Math.min(0.45, constructionDemand + failures * 0.12) * progress, volume);
      }
    }
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity|null} next
   * @param {number} direction
   * @param {import("playcanvas").Vec3|null} anchorPosition
   * @param {number} profile
   */
  #join(entity, next, direction, anchorPosition = null, profile = 1) {
    const ammo = globalThis.Ammo;
    const world = this.#app.systems.rigidbody.dynamicsWorld;
    // During construction the adhesive contact faces carry a small vertical
    // patch. Its third pin transmits bending through existing tissue so each
    // predecessor can support the next contributor. Completion releases these
    // temporary shapes to free suspension hinges.
    const patch = !this.#connected ? [-0.78, 0.78, 0] : [-0.78, 0.78];
    for (const across of patch) {
      const sections = this.#sections.localSections(entity);
      const edgeHalf = sections[direction > 0 ? sections.length - 1 : 0].halfExtents;
      const halfWidth = this.#horizontal ? edgeHalf.z : edgeHalf.x;
      const nextSections = next ? this.#sections.localSections(next) : null;
      const nextHalf = nextSections?.[direction > 0 ? 0 : nextSections.length - 1].halfExtents;
      const nextWidth = nextHalf ? this.#horizontal ? nextHalf.z : nextHalf.x : Infinity;
      const lateral = Math.sign(across) * Math.min(Math.abs(across), halfWidth * 0.95, nextWidth * 0.95);
      const height = across === 0 ? 0.1 * profile : 0;
      // A little chain slack permits gravity-loaded sag after contact.
      // Paired edge joints carry tension and resist deck roll; bank pins
      // remain at the actual contact edge, with a free deck hinge axis.
      const halfLength = next && this.#connected ? 0.505 : 0.5;
      const local = new this.#pc.Vec3(this.#horizontal ? direction * halfLength : lateral, height, this.#horizontal ? lateral : direction * halfLength);
      const pivot = new ammo.btVector3(local.x, local.y, local.z);
      let joint;
      if (next) {
        const other = new ammo.btVector3(this.#horizontal ? -direction * halfLength : lateral, height, this.#horizontal ? lateral : -direction * halfLength);
        joint = new ammo.btPoint2PointConstraint(entity.rigidbody.body, next.rigidbody.body, pivot, other);
        ammo.destroy(other);
      } else {
        joint = new ammo.btPoint2PointConstraint(entity.rigidbody.body, pivot);
        const point = anchorPosition.clone().add(local);
        point.y -= 0.13;
        const anchor = new ammo.btVector3(point.x, point.y, point.z);
        joint.setPivotB(anchor);
        ammo.destroy(anchor);
      }
      ammo.destroy(pivot);
      if (across === 0) {
        // Only the temporary bending pin has a finite impulse budget. The
        // two edge pins retain adhesive tensile continuity while overload can
        // fold the contact patch and let unsupported tissue reach real ground.
        joint.get_m_setting?.().set_m_impulseClamp(entity.rigidbody.mass * 8);
      }
      if (this.#connected || !next) {
        // Tight tension joints carry an 80 kg walker at the world's 60 Hz step.
        // Default point-joint correction stretches across successive bays and
        // turns the loaded exit into a steep ramp. Hinges and slack remain free.
        joint.setParam?.(2, 0.8, -1);
        joint.setParam?.(3, 0, -1);
      }
      world.addConstraint(joint, true);
      this.#joints.push(joint);
    }
  }

  /**
   * Finite internal muscle torque restores a yielded construction patch. The
   * opposite torque goes to its predecessor; only a real bank reacts against
   * the world. Translation, gravity and overload remain entirely in Ammo.
   * @param {import("playcanvas").Entity|null} first
   * @param {import("playcanvas").Entity} next
   * @param {number} profile
   * @param {number} deltaTime
   */
  #restorePatch(first, next, profile = 1, deltaTime = 1 / 60) {
    const reference = first?.getRotation() ?? new this.#pc.Quat();
    const relative = reference.clone().invert().mul(next.getRotation());
    const sign = relative.w < 0 ? -1 : 1;
    const error = new this.#pc.Vec3(relative.x, relative.y, relative.z).mulScalar(sign);
    const worldError = reference.transformVector(error);
    const speed = next.rigidbody.angularVelocity.clone();
    if (first) {
      speed.sub(first.rigidbody.angularVelocity);
    }
    const mass = next.rigidbody.mass;
    const gravity = Math.abs(this.#app.systems.rigidbody.gravity?.y ?? -9.81);
    const half = next.collision.halfExtents;
    const run = this.#horizontal ? half.x : half.z;
    const inertia = mass * (run * run + half.y * half.y) / 3 * (first ? 0.5 : 1);
    // Render updates can run faster than Ammo (for example 75 Hz vs 60 Hz).
    // The next torque is still held over a full native step; using render dt
    // here would overestimate damping/stiffness and excite that step's inertia.
    const step = deltaTime > 0 ? Math.max(this.#app.systems.rigidbody.fixedTimeStep ?? 1 / 60, deltaTime) : 1 / 240;
    const sectionDepth = Math.max(0.2, Number.isFinite(half.y) ? half.y / 0.13 : profile);
    // Anchored surplus gel actively tensions the longitudinal tissue. The
    // pressure remains a finite reciprocal native torque, with capacity still
    // proportional to the actual donated mass and physical section depth.
    const reinforcement = this.#poolMasses.size > 0 ? 2 : 1;
    const stiffness = mass * gravity * 6 * sectionDepth ** 2 * reinforcement;
    const damping = mass * 8 * sectionDepth * Math.sqrt(reinforcement);
    // Implicit spring coefficients remain dissipative when a render update
    // spans several native substeps. An explicit damping torque can overshoot
    // the box's small angular inertia and inject a violent alternating spin.
    const denominator = 1 + damping * step / inertia + stiffness * step * step / inertia;
    const spring = stiffness / denominator;
    const drag = (damping + stiffness * step) / denominator;
    const torque = worldError.mulScalar(-spring).sub(speed.mulScalar(drag));
    const limit = mass * gravity * 3 * sectionDepth * reinforcement;
    if (torque.length() > limit) {
      torque.normalize().mulScalar(limit);
    }
    next.rigidbody.applyTorque?.(torque);
    first?.rigidbody.applyTorque?.(torque.clone().mulScalar(-1));
  }

  /**
   * @param {number} deltaTime
   * @returns {Map<number,{position:import("playcanvas").Vec3,start:import("playcanvas").Vec3,end:import("playcanvas").Vec3,connected:boolean,thickness:number,width:number}>}
   */
  update(deltaTime = 1 / 60) {
    this.#reachAge += Math.max(0, deltaTime);
    this.#supportGraceAge += Math.max(0, deltaTime);
    // Failed attempts return fully to gravity. Periodic retries let the living
    // front recover when a movable obstacle clears without inventing new mass.
    if (!this.#connected && this.#materialComplete && this.#reachAge >= 38) {
      this.#reachAge = 0;
    }
    const previousPreparation = Math.floor(this.#preparation * 8);
    if (!this.#connected && (this.#anticipatedLoads.size > 0 || (this.#banks.size > 0 && this.#links.size > 0))) {
      this.#preparation = Math.min(1, this.#preparation + Math.max(0, deltaTime) / 1.8);
    }
    const preparationChanged = Math.floor(this.#preparation * 8) !== previousPreparation;
    if (this.#refreshAttachments() || preparationChanged) {
      this.#clearJoints();
      this.#truss.sync(this.#bodies, this.#links, this.#preparation, !this.#connected && this.#banks.size > 0, this.#banks);
      this.#redistribute(this.#supported);
      this.#buildJoints();
    }
    if (!this.#connected) {
      for (const [station, { entity }] of this.#bodies) {
        const next = this.#bodies.get(station + 1);
        if (next && this.#links.has(station)) {
          this.#restorePatch(entity, next.entity, this.#profiles.get(station) ?? 1, deltaTime);
        }
        if (this.#banks.has(station + ":-1") || this.#banks.has(station + ":1")) {
          this.#restorePatch(null, entity, this.#profiles.get(station) ?? 1, deltaTime);
        }
      }
    }
    const poses = new Map();
    let settled = this.#connected && this.#bodies.size > 0;
    for (const [station, { entity, target }] of this.#bodies) {
      const scale = Math.sqrt(this.#volumes.get(station) ?? 1) * (this.#profiles.get(station) ?? 1);
      const transform = entity.getWorldTransform();
      const position = transform.transformPoint(new this.#pc.Vec3(0, 0.13 * scale, 0));
      const velocity = entity.rigidbody.linearVelocity;
      const axis = transform.transformVector(new this.#pc.Vec3(this.#horizontal ? 1 : 0, 0, this.#horizontal ? 0 : 1));
      const forward = this.#horizontal ? axis.x : axis.z;
      const stressed = entity.up.y <= 0.65 || forward <= 0.2;
      // A connected liquid branch may fold while its already-requested bank
      // mass arrives and redistributes. This never publishes traversal support.
      // The grace is bounded per actual permanent handoff and immediately ends
      // if the native path to an adhesive bank disappears.
      const preparingSupport = this.isAwaitingSupport(station);
      const anchorLost = this.#poolMasses.size > 0 && !this.#hasNativeAnchor(station);
      const capacityStall = this.#poolMasses.size > 0 && this.#anticipatedLoads.has(station) &&
        this.#supportGraceAge >= 30 && !this.isLoadReady(station);
      const stressAge = (stressed || anchorLost || capacityStall) && !preparingSupport
        ? (this.#stressAge.get(station) ?? 0) + Math.max(0, deltaTime) : 0;
      this.#stressAge.set(station, stressAge);
      if (!this.#materialComplete && stressAge >= 2) {
        this.#failedStations.add(station);
      }
      const error = target.clone().sub(position);
      const freeFront = (this.#bodies.has(station + 1) && !this.#links.has(station)) ||
        (this.#bodies.has(station - 1) && !this.#links.has(station - 1)) ||
        (!this.#bodies.has(station + 1) && this.#supported(station + 1) && !this.#banks.has(`${station}:1`)) ||
        (!this.#bodies.has(station - 1) && this.#supported(station - 1) && !this.#banks.has(`${station}:-1`));
      if (!this.#connected && this.#banks.size > 0 && (!this.#materialComplete || this.#reachAge < 30)) {
        // Living tips crawl/climb toward a real bank under a speed-limited motor.
        // The motor does not add an anchor or move an entity transform.
        const desired = error.clone();
        desired.y = this.#materialComplete && freeFront ? desired.y : 0;
        const speed = this.#materialComplete ? 0.65 : 0.35;
        if (desired.length() > speed) {
          desired.normalize().mulScalar(speed);
        }
        const mass = freeFront ? this.#bodies.size * ACTOR_MASS.LATCH_SLUG : entity.rigidbody.mass;
        const motorGain = this.#materialComplete ? 12 : 70;
        const movingMass = this.#materialComplete ? mass : entity.rigidbody.mass;
        const responseStep = deltaTime > 0 ? Math.max(this.#app.systems.rigidbody.fixedTimeStep ?? 1 / 60, deltaTime) : 0;
        const response = motorGain / (1 + motorGain * mass / movingMass * responseStep);
        const force = desired.sub(velocity).mulScalar(mass * response);
        const gravity = this.#app.systems.rigidbody.gravity?.y ?? -9.81;
        if (this.#materialComplete) {
          force.y -= (entity.rigidbody.mass + this.#truss.massAt(station)) * gravity;
        } else {
          // Partial tissue crawls horizontally; it receives no vertical lift.
          force.y = 0;
        }
        const limit = mass * (this.#materialComplete ? 5 : 8) + entity.rigidbody.mass * Math.abs(gravity);
        if (force.length() > limit) {
          force.normalize().mulScalar(limit);
        }
        entity.rigidbody.applyForce(force);
      }
      // Both banks carry the chain through Ammo tension and contact. A
      // stable sloping deck is usable without returning to a straight line.
      // Evaluate the physical contact slope, not distance to an authored flat
      // target: a real tension chain can settle well below that target. Keep
      // the deck below a conservative 23-degree slope for walking admission.
      settled &&= velocity.length() < 0.2 &&
        entity.rigidbody.angularVelocity.length() < 0.15 && entity.up.y > 0.92;
      poses.set(station, this.getPose(station));
    }
    this.#settled = settled;

    return poses;
  }

  /**
   * @param {number} station
   * @returns {boolean}
   */
  isAwaitingSupport(station) {
    return this.#poolMasses.size > 0 && this.#supportGraceAge < 30 &&
      this.#hasNativeAnchor(station) && (this.#supportPending || this.#preparation < 1 || this.#reachAge < 4);
  }

  /**
   * @param {number} station
   * @returns {boolean}
   */
  #hasNativeAnchor(station) {
    let first = station;
    let last = station;
    while (this.#links.has(first - 1)) {
      first--;
    }
    while (this.#links.has(last)) {
      last++;
    }

    return this.#banks.has(first + ":-1") || this.#banks.has(last + ":1");
  }

  /**
   * @param {number} station
   * @returns {import("playcanvas").Entity|null}
   */
  getEntity(station) {
    return this.#bodies.get(station)?.entity ?? null;
  }

  /**
   * Verify a donated section through its actual physical link path to a bank.
   * Solver motion is pending; a bankless component fails only after a grace
   * interval, so a transient contact/shape change never consumes a donor.
   * @param {number} station
   * @returns {"pending"|"stable"|"failed"}
   */
  getPlacementStatus(station) {
    const entry = this.#bodies.get(station);
    if (this.#failedStations.has(station)) {
      return "failed";
    }
    if (!entry) {
      return "pending";
    }
    let first = station;
    let last = station;
    while (this.#links.has(first - 1)) {
      first--;
    }
    while (this.#links.has(last)) {
      last++;
    }
    let anchored = false;
    for (let index = first; index <= last; index++) {
      anchored ||= this.#banks.has(index + ":-1") || this.#banks.has(index + ":1");
    }
    if (!anchored) {
      return this.#reachAge >= 3 ? "failed" : "pending";
    }
    const body = entry.entity;
    const axis = body.getWorldTransform().transformVector(new this.#pc.Vec3(this.#horizontal ? 1 : 0, 0, this.#horizontal ? 0 : 1));
    const forward = this.#horizontal ? axis.x : axis.z;
    if (forward <= 0.2) {
      return this.#reachAge >= 3 ? "failed" : "pending";
    }

    return body.up.y > 0.65 && body.rigidbody.linearVelocity.length() < 0.25 &&
      body.rigidbody.angularVelocity.length() < 0.2 ? "stable" : "pending";
  }

  /**
   * A verified bound worker can traverse a gently moving support without
   * requiring the much stricter stationary admission thresholds.
   * @param {number} station
   * @returns {boolean}
   */
  isTraversalSafe(station) {
    const entity = this.#bodies.get(station)?.entity;
    if (!entity?.rigidbody?.body || this.#failedStations.has(station)) {
      return false;
    }
    let first = station;
    let last = station;
    while (this.#links.has(first - 1)) {
      first--;
    }
    while (this.#links.has(last)) {
      last++;
    }
    let anchored = false;
    for (let index = first; index <= last; index++) {
      anchored ||= this.#banks.has(index + ":-1") || this.#banks.has(index + ":1");
    }
    const axis = entity.getWorldTransform().transformVector(new this.#pc.Vec3(this.#horizontal ? 1 : 0, 0, this.#horizontal ? 0 : 1));
    const forward = this.#horizontal ? axis.x : axis.z;

    return anchored && entity.up.y > 0.65 && forward > 0.2 &&
      entity.rigidbody.linearVelocity.length() < 2 && entity.rigidbody.angularVelocity.length() < 3;
  }

  /**
   * A committed, prepared predecessor can accept an approaching worker despite
   * small native truss vibration. New candidate admission remains stationary.
   * @param {number} station
   * @returns {boolean}
   */
  isLoadReady(station) {
    if (!this.isTraversalSafe(station)) {
      return false;
    }
    const entity = this.#bodies.get(station).entity;
    const axis = entity.getWorldTransform().transformVector(new this.#pc.Vec3(this.#horizontal ? 1 : 0, 0, this.#horizontal ? 0 : 1));
    const forward = this.#horizontal ? axis.x : axis.z;

    return entity.up.y > 0.8 && forward > 0.5 && entity.rigidbody.linearVelocity.length() < 0.35 &&
      entity.rigidbody.angularVelocity.length() < 0.5;
  }

  /**
   * The existing component must finish its physical redistribution before the
   * next worker binds or hands off mass at this exact forecast frontier.
   * @param {number} station
   * @param {number} direction
   * @returns {boolean}
   */
  isPreparationComplete(station, direction) {
    return this.#bodies.has(station) && !this.#failedStations.has(station) &&
      this.#anticipatedLoads.get(station) === direction && this.#preparation >= 1;
  }

  /**
   * Failed incomplete sections include previously admitted predecessors that
   * yield under a later contributor. Return a copy for structural rollback.
   * @returns {number[]}
   */
  getFailedStations() {
    return [...this.#failedStations];
  }

  /**
   * Read the material spine and exact section surfaces without advancing the
   * simulation. Spine endpoints stay stable as individual cross-sections vary;
   * surfaceHeightAt and sections own the actual contact faces.
   * @param {number} station
   * @returns {{position:import("playcanvas").Vec3,start:import("playcanvas").Vec3,end:import("playcanvas").Vec3,connected:boolean,thickness:number,width:number}|null}
   */
  getPose(station) {
    const entry = this.#bodies.get(station);
    if (!entry) {
      return null;
    }
    const scale = Math.sqrt(this.#volumes.get(station) ?? 1);
    const profile = this.#profiles.get(station) ?? 1;
    const transform = entry.entity.getWorldTransform();

    return {
      position: transform.transformPoint(new this.#pc.Vec3(0, 0.13 * scale * profile, 0)),
      start: transform.transformPoint(new this.#pc.Vec3(this.#horizontal ? -0.5 : 0, 0.13 * scale * profile, this.#horizontal ? 0 : -0.5)),
      end: transform.transformPoint(new this.#pc.Vec3(this.#horizontal ? 0.5 : 0, 0.13 * scale * profile, this.#horizontal ? 0 : 0.5)),
      connected: this.#connected,
      reservoir: this.#poolMasses.has(station),
      fluid: !this.#connected,
      linkedPrevious: this.#links.has(station - 1),
      anchorDirection: this.#flowDirections.get(station) ?? 0,
      braces: this.#truss.poses(station),
      sections: this.#sections.poses(entry.entity),
      thickness: scale * profile,
      width: scale / profile,
      volume: this.#volumes.get(station) ?? 1,
      preparation: this.#anticipatedLoads.size > 0 && !this.#materialComplete ? this.#preparation : 1,
      flowDirection: this.#flowDirections.get(station) ?? 0,
      redistribution: !this.#materialComplete && this.#preparation < 1 && this.#flowDirections.get(station) ? {
        progress: this.#preparation,
        startVolume: this.#preparationStarts.get(station)?.volume ?? 1,
        volumeDelta: (this.#volumes.get(station) ?? 1) - (this.#preparationStarts.get(station)?.volume ?? 1),
        ...this.#components.get(station),
        direction: this.#flowDirections.get(station),
      } : null,
    };
  }

  /**
   * Query the upward face of each live Ammo box from its current transform and
   * collision dimensions. A footprint overlap alone never invents support
   * outside the actual tissue; the sample point must lie on its box face.
   * @param {number} x
   * @param {number} z
   * @param {number} radius
   * @param {number} maximumHeight
   * @returns {number|null}
   */
  surfaceHeightAt(x, z, radius = 0, maximumHeight = Infinity) {
    let highest = null;
    for (const { entity } of this.#bodies.values()) {
      const transform = entity.getWorldTransform();
      const normal = entity.up;
      if (normal.y < 0.35) {
        continue;
      }
      for (const section of this.#sections.localSections(entity)) {
        const half = section.halfExtents;
        const top = transform.transformPoint(section.center.clone().add(new this.#pc.Vec3(0, half.y, 0)));
        const height = top.y - (normal.x * (x - top.x) + normal.z * (z - top.z)) / normal.y;
        if (height > maximumHeight || (highest !== null && height <= highest)) {
          continue;
        }
        const local = transform.clone().invert().transformPoint(new this.#pc.Vec3(x, height, z)).sub(section.center);
        if (Math.abs(local.x) <= half.x + 0.000001 && Math.abs(local.z) <= half.z + 0.000001) {
          highest = height;
        }
      }
    }

    return highest;
  }

  /**
   * Articulated surfaces use capsule contact, including the bank approach,
   * so animated boots cannot snag an inclined moving deck edge.
   * @param {number} x
   * @param {number} z
   * @returns {number|null}
   */
  capsuleSupportHeightAt(x, z) {
    return this.surfaceHeightAt(x, z);
  }

  /**
   * Both physical banks and all intervening material links remain attached.
   * Load-induced motion can unsettle the deck without losing this connection.
   * @returns {boolean}
   */
  get connected() {
    return this.#connected;
  }

  /**
   * @returns {boolean}
   */
  get settled() {
    return this.#settled;
  }

  /**
   * @returns {string}
   */
  get status() {
    return this.#bodies.size ? `${this.#bodies.size} gel masses | ${this.#connected ? this.#settled ? "settled" : "reshaping" : this.#materialComplete ? this.#reachAge >= 30 ? "reach blocked" : "seeking bank" : "anchoring"} | ` : "";
  }

  #clearJoints() {
    this.#truss.clearJoints();
    const world = this.#app.systems?.rigidbody?.dynamicsWorld;
    for (const joint of this.#joints) {
      world?.removeConstraint(joint);
      globalThis.Ammo.destroy(joint);
    }
    this.#joints = [];
  }

  destroy() {
    this.#clearJoints();
    this.#truss.destroy();
    for (const { entity } of this.#bodies.values()) {
      this.#sections.release(entity);
      this.#app.fire?.("bridge-slime:before-body-change", entity, "destroy");
      entity.destroy();
    }
    this.#bodies.clear();
  }
}
