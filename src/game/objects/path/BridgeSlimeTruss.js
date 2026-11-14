const DONOR_VOLUME = 8 * 0.5 * 0.13 * 0.94;

/**
 * Real finite gel members close underside triangles between deck bodies.
 */
export class BridgeSlimeTruss {
  /**
   * @type {typeof import("playcanvas")}
   */
  #pc;
  /**
   * @type {import("playcanvas").Application}
   */
  #app;
  /**
   * @type {boolean}
   */
  #horizontal;
  /**
   * @type {Map<number, Array<{id:string,entity:import("playcanvas").Entity,length:number,radius:number,volume:number,progress:number,startRadius:number,targetRadius:number,kind:string}>>}
   */
  #bays = new Map();
  /**
   * @type {import("sync-ammo/dist/ammo").btPoint2PointConstraint[]}
   */
  #joints = [];
  /**
   * @type {WeakMap<import("playcanvas").Entity,number>}
   */
  #lateralSigns = new WeakMap();

  /**
   * @param {typeof import("playcanvas")} pc
   * @param {import("playcanvas").Application} app
   * @param {boolean} horizontal
   */
  constructor(pc, app, horizontal) {
    this.#pc = pc;
    this.#app = app;
    this.#horizontal = horizontal;
  }

  /**
   * Call only with all native constraints removed. Existing members keep their
   * transforms; new material thickens in place and is deducted from the deck.
   * @param {Map<number,{entity:import("playcanvas").Entity}>} bodies
   * @param {Set<number>} links
   * @param {number} preparation
   * @param {boolean} enabled
   * @param {Set<string>} banks
   */
  sync(bodies, links, preparation, enabled, banks) {
    for (const [station, members] of this.#bays) {
      if (!enabled || !links.has(station) || !bodies.has(station) || !bodies.has(station + 1)) {
        for (const member of members) {
          this.#app.fire?.("bridge-slime:before-body-change", member.entity, "destroy");
          member.entity.destroy();
        }
        this.#bays.delete(station);
      }
    }
    if (!enabled) {
      return;
    }
    for (const station of links) {
      const first = bodies.get(station)?.entity;
      const next = bodies.get(station + 1)?.entity;
      if (!first || !next) {
        continue;
      }
      if (!this.#bays.has(station)) {
        const left = this.#point(first, -0.35, -first.collision.halfExtents.y);
        const right = this.#point(next, 0.35, -next.collision.halfExtents.y);
        const top = this.#point(first, 0.5, 0);
        const bottom = this.#point(first, 0.5, -0.65);
        this.#bays.set(station, [
          this.#create(station, "left", left, bottom, "diagonal"),
          this.#create(station, "right", bottom, right, "diagonal"),
          this.#create(station, "post", top, bottom, "post"),
        ]);
      }
      let firstStation = station;
      let lastStation = station + 1;
      while (links.has(firstStation - 1)) {
        firstStation--;
      }
      while (links.has(lastStation)) {
        lastStation++;
      }
      const rootedAtStart = banks.has(firstStation + ":-1");
      const rootedAtEnd = banks.has(lastStation + ":1");
      const distance = rootedAtStart ? station - firstStation : lastStation - 1 - station;
      const reach = lastStation - firstStation + 1 - distance;
      const targetRadius = Math.min(0.16, 0.075 * (1 + (rootedAtStart || rootedAtEnd ? 0.22 * Math.max(0, reach - 2) : 0)));
      for (const member of this.#bays.get(station)) {
        if (member.targetRadius !== targetRadius) {
          member.startRadius = member.radius;
          member.targetRadius = targetRadius;
        }
        const progress = Math.max(0.03, preparation);
        const radius = member.startRadius + (member.targetRadius - member.startRadius) * progress;
        const volume = 4 * radius * radius * member.length / DONOR_VOLUME;
        member.progress = progress;
        member.radius = radius;
        member.volume = volume;
        const entity = member.entity;
        const half = new this.#pc.Vec3(radius, radius, member.length / 2);
        if (!entity.collision.halfExtents.equals(half)) {
          const linear = entity.rigidbody.linearVelocity.clone();
          const angular = entity.rigidbody.angularVelocity.clone();
          this.#app.fire?.("bridge-slime:before-body-change", entity, "replace");
          entity.collision.halfExtents = half;
          entity.rigidbody.linearVelocity = linear;
          entity.rigidbody.angularVelocity = angular;
          this.#app.fire?.("bridge-slime:after-body-change", entity);
        }
      }
    }
  }

  /**
   * @param {number} station
   * @param {string} suffix
   * @param {import("playcanvas").Vec3} start
   * @param {import("playcanvas").Vec3} end
   * @param {string} kind
   * @returns {{id:string,entity:import("playcanvas").Entity,length:number,radius:number,volume:number,progress:number,kind:string}}
   */
  #create(station, suffix, start, end, kind) {
    const entity = new this.#pc.Entity(`Living gel truss ${station} ${suffix}`);
    this.#app.root.addChild(entity);
    entity.setPosition(start.clone().add(end).mulScalar(0.5));
    const vertical = Math.abs(end.y - start.y) / start.distance(end) > 0.95;
    entity.lookAt(end, vertical ? this.#pc.Vec3.RIGHT : this.#pc.Vec3.UP);
    entity.tags.add("hero-moving-support", "bridge-slime-truss");
    const lateral = new this.#pc.Vec3(this.#horizontal ? 0 : 1, 0, this.#horizontal ? 1 : 0);
    const right = entity.getWorldTransform().transformVector(this.#pc.Vec3.RIGHT);
    this.#lateralSigns.set(entity, right.dot(lateral) < 0 ? -1 : 1);
    const length = start.distance(end);
    const radius = 0.075 * Math.sqrt(0.03);
    entity.addComponent("collision", {
      type: "box",
      halfExtents: new this.#pc.Vec3(radius, radius, length / 2),
    });
    entity.addComponent("rigidbody", {
      type: "dynamic",
      mass: 0.001,
      friction: 0.7,
      restitution: 0,
      linearDamping: 0.7,
      angularDamping: 0.85,
    });

    return {
      id: `${station}:${suffix}`,
      entity,
      length,
      radius,
      volume: 0,
      progress: 0.03,
      startRadius: radius,
      targetRadius: 0,
      kind,
    };
  }

  /**
   * @param {number} first
   * @param {number} last
   * @param {number} donorMass
   * @returns {number}
   */
  allocate(first, last, donorMass) {
    let volume = 0;
    for (let station = first; station < last; station++) {
      for (const member of this.#bays.get(station) ?? []) {
        if (member.entity.rigidbody.mass !== member.volume * donorMass) {
          this.#app.fire?.("bridge-slime:before-body-change", member.entity, "replace");
          member.entity.rigidbody.mass = member.volume * donorMass;
          this.#app.fire?.("bridge-slime:after-body-change", member.entity);
        }
        volume += member.volume;
      }
    }

    return volume;
  }

  /**
   * @param {Map<number,{entity:import("playcanvas").Entity}>} bodies
   */
  buildJoints(bodies) {
    for (const [station, [left, right, post]] of this.#bays) {
      const first = bodies.get(station).entity;
      const next = bodies.get(station + 1).entity;
      this.#join(left.entity, first, new this.#pc.Vec3(0, 0, left.length / 2), this.#local(-0.35, -first.collision.halfExtents.y));
      this.#join(left.entity, post.entity, new this.#pc.Vec3(0, 0, -left.length / 2), new this.#pc.Vec3(0, 0, -post.length / 2));
      this.#join(right.entity, post.entity, new this.#pc.Vec3(0, 0, right.length / 2), new this.#pc.Vec3(0, 0, -post.length / 2));
      this.#join(right.entity, next, new this.#pc.Vec3(0, 0, -right.length / 2), this.#local(0.35, -next.collision.halfExtents.y));
      this.#join(post.entity, first, new this.#pc.Vec3(0, 0, post.length / 2), this.#local(0.5, 0));

    }
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {import("playcanvas").Entity} next
   * @param {import("playcanvas").Vec3} local
   * @param {import("playcanvas").Vec3} other
   */
  #join(entity, next, local, other) {
    const ammo = globalThis.Ammo;
    // Two real pivots across the rod's square section prevent the entire
    // underside triangle swinging sideways as an unconstrained 3D mechanism.
    // Split the finite impulse budget across the pair; no world lock is added.
    const width = entity.collision.halfExtents.x * 0.75;
    const offset = new this.#pc.Vec3(width * this.#lateralSigns.get(entity), 0, 0);
    const nextSign = this.#lateralSigns.get(next);
    const nextOffset = nextSign ? new this.#pc.Vec3(width * nextSign, 0, 0) :
      new this.#pc.Vec3(this.#horizontal ? 0 : width, 0, this.#horizontal ? width : 0);
    for (const side of [-1, 1]) {
      const pointA = local.clone().add(offset.clone().mulScalar(side));
      const pointB = other.clone().add(nextOffset.clone().mulScalar(side));
      const first = new ammo.btVector3(pointA.x, pointA.y, pointA.z);
      const second = new ammo.btVector3(pointB.x, pointB.y, pointB.z);
      const joint = new ammo.btPoint2PointConstraint(entity.rigidbody.body, next.rigidbody.body, first, second);
      ammo.destroy(first);
      ammo.destroy(second);
      joint.slimeTruss = true;
      const impulseBudget = entity.rigidbody.mass * 60;
      joint.get_m_setting?.().set_m_impulseClamp(impulseBudget / 2);
      joint.setParam?.(2, 0.3, -1);
      joint.setParam?.(3, 0, -1);
      this.#app.systems.rigidbody.dynamicsWorld.addConstraint(joint, true);
      this.#joints.push(joint);
    }
  }

  /**
   * @param {number} along
   * @param {number} height
   * @returns {import("playcanvas").Vec3}
   */
  #local(along, height) {
    return new this.#pc.Vec3(this.#horizontal ? along : 0, height, this.#horizontal ? 0 : along);
  }

  /**
   * @param {import("playcanvas").Entity} entity
   * @param {number} along
   * @param {number} height
   * @returns {import("playcanvas").Vec3}
   */
  #point(entity, along, height) {
    return entity.getWorldTransform().transformPoint(this.#local(along, height));
  }

  /**
   * @param {number} station
   * @returns {Array<{id:string,start:import("playcanvas").Vec3,end:import("playcanvas").Vec3,radius:number,mass:number,volume:number,kind:string}>}
   */
  poses(station) {
    const poses = [];
    for (const member of this.#bays.get(station) ?? []) {
      const transform = member.entity.getWorldTransform();
      poses.push({
        id: member.id,
        start: transform.transformPoint(new this.#pc.Vec3(0, 0, member.length / 2)),
        end: transform.transformPoint(new this.#pc.Vec3(0, 0, -member.length / 2)),
        radius: member.radius,
        mass: member.entity.rigidbody.mass,
        volume: member.volume,
        kind: member.kind,
      });
    }

    return poses;
  }

  /**
   * @param {number} station
   * @returns {number}
   */
  massAt(station) {
    let mass = 0;
    for (const bay of [station - 1, station]) {
      for (const member of this.#bays.get(bay) ?? []) {
        mass += member.entity.rigidbody.mass * 0.5;
      }
    }

    return mass;
  }

  clearJoints() {
    for (const joint of this.#joints) {
      this.#app.systems.rigidbody.dynamicsWorld.removeConstraint(joint);
      globalThis.Ammo.destroy(joint);
    }
    this.#joints = [];
  }

  destroy() {
    this.clearJoints();
    for (const members of this.#bays.values()) {
      for (const member of members) {
        this.#app.fire?.("bridge-slime:before-body-change", member.entity, "destroy");
        member.entity.destroy();
      }
    }
    this.#bays.clear();
  }
}
