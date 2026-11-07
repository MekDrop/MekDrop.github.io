/**
 * Ground-sampled belly deformation layered over the authored crawl.
 */
export class LatchGroundCrawl {
  /**
   * @type {string}
   */
  phase = "flat";
  /**
   * @type {number}
   */
  phaseAge = 0;
  /**
   * @type {Array<{phase:string,time:number}>}
   */
  history = [];
  /**
   * @returns {boolean}
   */
  get active() {
    return this.phase !== "flat";
  }
  /**
   * @returns {number}
   */
  get speedLimit() {
    return this.phase === "reach" ? 0.2 : 0.4;
  }
  /**
   * @returns {number}
   */
  get targetHeight() {
    return this.phase === "reach" ? this.lowerHeight : this.upperHeight;
  }
  /**
   * @type {boolean}
   */
  destroyed = false;
  /**
   * @param {import("./LatchSlug.js").LatchSlug} owner
   * @param {import("playcanvas").Entity} model
   */
  constructor(owner, model) {
    this.owner = owner;
    this.body = model.findByName("body");
    this.head = model.findByName("head");
    this.belly = ["belly_front", "belly_rear", "belly_L", "belly_R"].map(/**
     *
     * @param {string} name
     */
      name => model.findByName(name)).filter(Boolean);
    this.records = [this.body, ...this.belly, this.head].filter(Boolean).map(/**
     *
     * @param {import("playcanvas").GraphNode} node
     */
      node => ({
        node,
        position: new owner.pc.Vec3(),
        scale: new owner.pc.Vec3(),
        lift: 0,
      }));
    this.weight = 0;
    this.restAge = 1;
    this.applied = false;
    this.handles = [owner.app.on("update", this.update, this), owner.app.on("prerender", this.apply, this), owner.app.on("postrender", this.restore, this)];
  }
  /**
   * @param {number} dt
   */
  update(dt) {
    if (this.destroyed || !Number.isFinite(dt) || dt <= 0) {
      return;
    }
    const s = this.owner;
    const enabled = s.alive && !s.airborne && !s.carrier && !s.gatewayArrival.active && s.stateName !== "LatchPressState" && s.stateName !== "LatchLeapState";
    if (this.active) {
      this.stepAge += dt;
      if (!enabled || this.stepAge > 6) {
        this.#phase("flat");
      } else {
        this.phaseAge += dt;
        if (this.phase === "reach" && this.phaseAge >= 0.5) {
          this.#phase("transfer");
        } else if (this.phase === "transfer" && s.position.y >= this.upperHeight - 0.045) {
          this.#phase("pull");
        } else if (this.phase === "pull" && this.phaseAge >= 0.55) {
          this.#phase("settle");
        } else if (this.phase === "settle" && this.phaseAge >= 0.22) {
          this.#phase("flat");
        }
      }
    }
    if (this.active) {
      this.weight=0;

      return;
    }
    this.restAge+=dt;
    let low = Infinity, high = -Infinity;
    for (const record of this.records.slice(1)) {
      const p = record.node.getPosition();
      const from = p.clone(), to = p.clone();
      from.y = s.position.y + 0.4;
      to.y = s.position.y - 0.4;
      const hit = enabled ? s.app.systems.rigidbody.raycastFirst(from, to, {
        /**
         * @param {import("playcanvas").Entity} entity
         */
        filterCallback: entity => entity.rigidbody?.type === "static",
      }) : null;
      const lift = hit?.normal.y > 0.7 ? Math.max(-0.22, Math.min(0.25, hit.point.y - s.position.y)) : 0;
      low = Math.min(low, lift);
      high = Math.max(high, lift);
      record.lift += (lift - record.lift) * (1 - Math.exp(-12 * dt));
    }
    const target = enabled && this.restAge>=.3 && high - low > 0.055 ? 1 : 0;
    this.weight += (target - this.weight) * (1 - Math.exp(-10 * dt));
  }
  apply() {
    if (this.destroyed || this.applied || (!this.active && this.weight < 0.001) || !this.owner.alive || this.owner.airborne || this.owner.carrier) {
      return;
    }
    for (const record of this.records) {
      record.position.copy(record.node.getLocalPosition());
      record.scale.copy(record.node.getLocalScale());
    }
    this.applied = true;
    if (this.active) {
      this.#poseStep();

      return;
    }
    if (this.body) {
      const p = this.body.getLocalPosition().clone();
      p.y += (0.23 - p.y) * this.weight;
      this.body.setLocalPosition(p);
      const scale = this.body.getLocalScale().clone();
      const flatten = 1 - 0.14 * this.weight;
      scale.y *= flatten;
      scale.x /= Math.sqrt(flatten);
      scale.z /= Math.sqrt(flatten);
      this.body.setLocalScale(scale);
    }
    for (const record of this.records.slice(1)) {
      const p = record.node.getPosition().clone();
      p.y += record.lift * this.weight;
      record.node.setPosition(p);
    }
  }

  /**
   * Front contact is established before the native capsule is allowed to rise.
   * These anchors deform only the skinned mesh, never the physics root.
   * @param {import("playcanvas").Vec3} point
   * @param {import("playcanvas").Vec3} direction
   * @returns {boolean}
   */
  begin(point, direction) {
    if (this.destroyed || this.active || point.y - this.owner.position.y < 0.12 || point.y - this.owner.position.y > 0.28 || !this.body) {
      return false;
    }
    const { pc } = this.owner;
    this.direction = direction.clone().normalize();
    this.lowerHeight = this.owner.position.y;
    this.stepAge = 0;
    this.upperHeight = point.y;
    this.frontStart = this.belly[0].getPosition().clone();
    this.frontAnchor = point.clone().add(new pc.Vec3(0, 0.18, 0));
    this.rearAnchor = this.owner.position.clone().sub(this.direction.clone().mulScalar(0.22)).add(new pc.Vec3(0, 0.18, 0));
    const from = this.owner.position.clone().add(new pc.Vec3(0, (point.y - this.lowerHeight) / 2, 0));
    const to = point.clone();
    to.y = from.y;
    const hit = this.owner.app.systems.rigidbody.raycastFirst(from, to, {
      /**
       * @param {import("playcanvas").Entity} entity
       */
      filterCallback: entity => entity.rigidbody?.type === "static",
    });
    this.edge = hit && Math.abs(hit.normal.y) < 0.5 ? hit.point.clone() : point.clone().sub(this.direction.clone().mulScalar(0.1));
    if (this.edge.clone().sub(this.owner.position).dot(this.direction)>0.4) {
      return false;
    }
    const lowerPoint = this.edge.clone().sub(this.direction.clone().mulScalar(.12));
    const lowerFrom = lowerPoint.clone(), lowerTo = lowerPoint.clone();
    lowerFrom.y=this.upperHeight+.4;
    lowerTo.y=this.lowerHeight-.4;
    const lowerHit=this.owner.app.systems.rigidbody.raycastFirst(lowerFrom,lowerTo,{
      /**
       * @param {import("playcanvas").Entity} entity
       */
      filterCallback:entity=>entity.rigidbody?.type==='static',
    });
    if (lowerHit?.normal.y>.7 && Math.abs(lowerHit.point.y-this.lowerHeight)<.08) {
      this.lowerHeight=lowerHit.point.y;
    }
    this.lowerRun = this.#treadRun(-1,this.lowerHeight);
    this.upperRun = this.#treadRun(1,this.upperHeight);
    this.frontAnchor = this.edge.clone().add(this.direction.clone().mulScalar(Math.min(.35,this.upperRun*.75)));
    this.frontAnchor.y=this.upperHeight+.18;
    this.rearAnchor = this.edge.clone().sub(this.direction.clone().mulScalar(Math.min(.35,this.lowerRun*.75)));
    this.rearAnchor.y=this.lowerHeight+.18;
    this.owner.faceTarget?.({position:point});
    this.#phase("reach");

    return true;
  }

  /**
   * Bound each contact segment by the next real riser or drop.
   * @param {number} side
   * @param {number} height
   * @returns {number}
   */
  #treadRun(side,height) {
    const {pc,app} = this.owner;
    for (const distance of [.1,.25,.4,.55,.7,.85]) {
      const point = this.edge.clone().add(this.direction.clone().mulScalar(side*distance));
      const from = point.clone(),to=point.clone();
      from.y=this.upperHeight+.4;
      to.y=this.lowerHeight-.6;
      const hit=app.systems.rigidbody.raycastFirst(from,to,{
        /**
         * @param {import("playcanvas").Entity} entity
         */
        filterCallback:entity=>entity.rigidbody?.type==='static',
      });
      if (!hit || hit.normal.y<.7 || Math.abs(hit.point.y-height)>.06) {
        return Math.max(.08,distance-.05);
      }
    }

    return .8;
  }

  /**
   * @param {string} phase
   */
  #phase(phase) {
    this.phase = phase;
    this.phaseAge = 0;
    if (phase==='flat') {
      this.weight=0;
      this.restAge=0;
    }
    this.history.push({
      phase,
      time:this.owner.elapsed ?? 0,
    });
    if (this.history.length > 32) {
      this.history.shift();
    }
  }

  #poseStep() {
    const { pc } = this.owner;
    const smooth = pc.math.smoothstep(0, 1, this.phaseAge / (this.phase === "reach" ? 0.5 : 0.55));
    const reach = this.phase === "reach" ? smooth : 1;
    const gather = this.phase === "pull" ? smooth : this.phase === "settle" ? 1 : 0;
    const release = this.phase === "settle" ? 1 - pc.math.smoothstep(0, 0.22, this.phaseAge) : 1;
    const front = this.frontStart.clone().lerp(this.frontStart, this.frontAnchor, reach);
    const rear = this.rearAnchor.clone();
    const desiredFront = this.edge.clone().add(this.direction.clone().mulScalar(0.43));
    const desiredRear = this.edge.clone().add(this.direction.clone().mulScalar(0.08));
    desiredFront.y = desiredRear.y = this.upperHeight + 0.18;
    front.lerp(front, desiredFront, gather);
    rear.lerp(rear, desiredRear, gather);
    const center = front.clone().lerp(front, rear, 0.5).add(new pc.Vec3(0, 0.05, 0));
    const bodyPosition = this.body.getPosition().clone().lerp(this.body.getPosition(), center, reach * release);
    this.body.setPosition(bodyPosition);
    const scale = this.body.getLocalScale().clone();
    const stretch = 1 + 0.28 * Math.sin(Math.PI * (0.35 + gather * 0.65)) * reach * release;
    scale.z *= stretch;
    scale.y /= stretch;
    this.body.setLocalScale(scale);
    for (const record of this.records.slice(1)) {
      const name = record.node.name;
      let target;
      if (name === "head" || name === "belly_front") {
        target = front.clone();
        if (name === "head") {
          target.add(new pc.Vec3(0, 0.14, 0)).add(this.direction.clone().mulScalar(0.04));
        }
      } else if (name === "belly_rear") {
        target = rear;
      } else {
        target = this.edge.clone().add(new pc.Vec3(0, (this.lowerHeight + this.upperHeight) / 2 - this.edge.y + 0.18, 0));
        target.add(new pc.Vec3(-this.direction.z, 0, this.direction.x).mulScalar(name === "belly_L" ? 0.23 : -0.23));
        const gathered = center.clone().add(new pc.Vec3(0, -0.05, 0));
        gathered.add(new pc.Vec3(-this.direction.z, 0, this.direction.x).mulScalar(name === "belly_L" ? 0.23 : -0.23));
        target.lerp(target, gathered, gather);
      }
      const posed = record.node.getPosition().clone();
      record.node.setPosition(posed.lerp(posed, target, reach * release));
    }
  }
  restore() {
    if (!this.applied) {
      return;
    }
    for (const record of this.records) {
      record.node.setLocalPosition(record.position);
      record.node.setLocalScale(record.scale);
    }
    this.applied = false;
  }
  destroy() {
    this.destroyed = true;
    this.restore();
    for (const handle of this.handles) {
      handle.off();
    }
  }
}
