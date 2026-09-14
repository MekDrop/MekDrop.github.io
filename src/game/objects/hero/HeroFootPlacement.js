const CONTACT_EPSILON = 0.006;
const CONTACT_REACH = 0.14;
const MAXIMUM_FOOT_LIFT = 0.32;
const MAXIMUM_FOOT_TILT = 30;
const NORMAL_SAMPLE_DISTANCE = 0.08;
const MAXIMUM_NORMAL_SAMPLE_RISE = 0.2;
const RELEASE_RESPONSE = 18;
const TILT_RESPONSE = 20;

export class HeroFootPlacement {
  #pc;
  #surfaceHeightAt;
  #getHeroPosition;
  #feet;
  #enabled = false;

  constructor({ pc, surfaceHeightAt, getHeroPosition, left, right }) {
    this.#pc = pc;
    this.#surfaceHeightAt = surfaceHeightAt;
    this.#getHeroPosition = getHeroPosition;
    this.#feet = [
      this.#createFoot("Left leg surface adjustment", left),
      this.#createFoot("Right leg surface adjustment", right),
    ];
  }

  get state() {
    return Object.fromEntries(
      this.#feet.map((foot) => [
        foot.side,
        {
          appliedLift: foot.appliedLift,
          minimumClearance: foot.minimumClearance,
          tiltDegrees: foot.tiltDegrees,
        },
      ]),
    );
  }

  get grassContacts() {
    if (!this.#enabled) {
      return [];
    }
    return this.#feet.flatMap((foot) => {
      const bounds = foot.sole.render?.meshInstances?.[0]?.mesh?.aabb;
      if (!bounds || foot.minimumClearance === null) {
        return [];
      }
      const transform = foot.sole.getWorldTransform();
      const center = transform.transformPoint(new this.#pc.Vec3(
        bounds.center.x, bounds.center.y - bounds.halfExtents.y, bounds.center.z,
      ));
      const across = transform.transformVector(new this.#pc.Vec3(bounds.halfExtents.x, 0, 0));
      const along = transform.transformVector(new this.#pc.Vec3(0, 0, bounds.halfExtents.z));
      const length = Math.hypot(along.x, along.z);
      const pressure = Math.max(0, 1 - Math.max(0, foot.minimumClearance - CONTACT_EPSILON) / 0.075);
      return [{
        side: foot.side,
        x: center.x, y: center.y, z: center.z,
        directionX: along.x / Math.max(length, 0.001),
        directionZ: along.z / Math.max(length, 0.001),
        halfWidth: Math.hypot(across.x, across.z) + 0.025,
        halfLength: length + 0.035,
        pressure,
      }];
    });
  }

  update(deltaTime, enabled) {
    this.#enabled = enabled;
    const maximumSurfaceHeight =
      this.#getHeroPosition().y + MAXIMUM_FOOT_LIFT;
    for (const foot of this.#feet) {
      this.#resetWrapper(foot);
      if (!enabled) {
        foot.appliedLift = 0;
        foot.minimumClearance = null;
        foot.tiltWeight = 0;
        foot.tiltDegrees = 0;
        continue;
      }

      const unadjustedContacts = this.#contacts(
        foot,
        maximumSurfaceHeight,
      );
      this.#alignBootToSurface(
        foot,
        unadjustedContacts,
        maximumSurfaceHeight,
        deltaTime,
      );
      const contacts = this.#contacts(foot, maximumSurfaceHeight);
      const targetLift = Math.min(
        MAXIMUM_FOOT_LIFT,
        Math.max(
          0,
          ...contacts.map(
            ({ point, surfaceHeight }) =>
              surfaceHeight - point.y + CONTACT_EPSILON,
          ),
        ),
      );
      if (targetLift >= foot.appliedLift) {
        foot.appliedLift = targetLift;
      } else {
        const releaseBlend = 1 - Math.exp(-RELEASE_RESPONSE * deltaTime);
        foot.appliedLift +=
          (targetLift - foot.appliedLift) * releaseBlend;
      }

      const wrapperPosition = foot.wrapper.getPosition().clone();
      foot.wrapper.setPosition(
        wrapperPosition.x,
        wrapperPosition.y + foot.appliedLift,
        wrapperPosition.z,
      );
      foot.minimumClearance = contacts.length
        ? Math.min(
            ...contacts.map(
              ({ point, surfaceHeight }) =>
                point.y + foot.appliedLift - surfaceHeight,
            ),
          )
        : null;
    }
  }

  destroy() {
    for (const foot of this.#feet) {
      this.#resetWrapper(foot);
    }
    this.#feet = [];
  }

  #createFoot(name, { side, leg, sole, cuff, tiltingParts }) {
    const visualChildren = [...leg.children];
    const wrapper = new this.#pc.Entity(name);
    leg.addChild(wrapper);
    for (const child of visualChildren) {
      wrapper.addChild(child);
    }
    const cuffPosition = cuff.getLocalPosition().clone();
    const tilt = new this.#pc.Entity(`${side} boot surface tilt`);
    tilt.setLocalPosition(cuffPosition);
    wrapper.addChild(tilt);
    for (const part of tiltingParts) {
      const position = part.getLocalPosition().clone();
      const rotation = part.getLocalRotation().clone();
      const scale = part.getLocalScale().clone();
      tilt.addChild(part);
      part.setLocalPosition(
        position.x - cuffPosition.x,
        position.y - cuffPosition.y,
        position.z - cuffPosition.z,
      );
      part.setLocalRotation(rotation);
      part.setLocalScale(scale);
    }
    return {
      side,
      sole,
      wrapper,
      tilt,
      appliedLift: 0,
      minimumClearance: null,
      surfaceNormal: new this.#pc.Vec3(0, 1, 0),
      tiltWeight: 0,
      tiltDegrees: 0,
    };
  }

  #resetWrapper(foot) {
    foot.wrapper.setLocalPosition(0, 0, 0);
    foot.tilt.setLocalRotation(0, 0, 0, 1);
  }

  #alignBootToSurface(
    foot,
    contacts,
    maximumSurfaceHeight,
    deltaTime,
  ) {
    const closestContactDistance = contacts.length
      ? Math.min(
          ...contacts.map(({ point, surfaceHeight }) =>
            Math.abs(point.y - surfaceHeight),
          ),
        )
      : Number.POSITIVE_INFINITY;
    const normal = this.#surfaceNormalAt(
      foot.sole.getPosition(),
      maximumSurfaceHeight,
    );
    const targetWeight =
      normal && closestContactDistance < CONTACT_REACH ? 1 : 0;
    if (normal) {
      foot.surfaceNormal.copy(normal);
    }
    const tiltBlend = 1 - Math.exp(-TILT_RESPONSE * deltaTime);
    foot.tiltWeight += (targetWeight - foot.tiltWeight) * tiltBlend;
    if (foot.tiltWeight < 0.001) {
      foot.tiltWeight = 0;
      foot.tiltDegrees = 0;
      return;
    }

    const baseRotation = foot.tilt.getRotation().clone();
    const baseUp = baseRotation
      .transformVector(new this.#pc.Vec3(0, 1, 0))
      .normalize();
    const deltaRotation = new this.#pc.Quat().setFromDirections(
      baseUp,
      foot.surfaceNormal,
    );
    const targetRotation = new this.#pc.Quat().mul2(
      deltaRotation,
      baseRotation,
    );
    const adjustedRotation = new this.#pc.Quat().slerp(
      baseRotation,
      targetRotation,
      foot.tiltWeight,
    );
    foot.tilt.setRotation(adjustedRotation);
    foot.tiltDegrees =
      (Math.acos(
        Math.max(-1, Math.min(1, baseUp.dot(foot.surfaceNormal))),
      ) *
        180 *
        foot.tiltWeight) /
      Math.PI;
  }

  #surfaceNormalAt(position, maximumSurfaceHeight) {
    const distance = NORMAL_SAMPLE_DISTANCE;
    const west = this.#surfaceHeightAt(
      position.x - distance,
      position.z,
      maximumSurfaceHeight,
    );
    const east = this.#surfaceHeightAt(
      position.x + distance,
      position.z,
      maximumSurfaceHeight,
    );
    const north = this.#surfaceHeightAt(
      position.x,
      position.z - distance,
      maximumSurfaceHeight,
    );
    const south = this.#surfaceHeightAt(
      position.x,
      position.z + distance,
      maximumSurfaceHeight,
    );
    if (![west, east, north, south].every(Number.isFinite)) {
      return null;
    }
    if (
      Math.abs(east - west) > MAXIMUM_NORMAL_SAMPLE_RISE ||
      Math.abs(south - north) > MAXIMUM_NORMAL_SAMPLE_RISE
    ) {
      return null;
    }

    let gradientX = (east - west) / (distance * 2);
    let gradientZ = (south - north) / (distance * 2);
    const gradientLength = Math.hypot(gradientX, gradientZ);
    const maximumGradient = Math.tan(
      (MAXIMUM_FOOT_TILT * Math.PI) / 180,
    );
    if (gradientLength > maximumGradient) {
      const scale = maximumGradient / gradientLength;
      gradientX *= scale;
      gradientZ *= scale;
    }
    return new this.#pc.Vec3(-gradientX, 1, -gradientZ).normalize();
  }

  #contacts(foot, maximumSurfaceHeight) {
    const bounds = foot.sole.render?.meshInstances?.[0]?.mesh?.aabb;
    if (!bounds) {
      return [];
    }

    const minimumX = bounds.center.x - bounds.halfExtents.x;
    const maximumX = bounds.center.x + bounds.halfExtents.x;
    const minimumY = bounds.center.y - bounds.halfExtents.y;
    const minimumZ = bounds.center.z - bounds.halfExtents.z;
    const maximumZ = bounds.center.z + bounds.halfExtents.z;
    const contactCoordinates = [
      [minimumX, minimumY, minimumZ],
      [maximumX, minimumY, minimumZ],
      [bounds.center.x, minimumY, bounds.center.z],
      [minimumX, minimumY, maximumZ],
      [maximumX, minimumY, maximumZ],
    ];
    const transform = foot.sole.getWorldTransform();
    return contactCoordinates.flatMap(([x, y, z]) => {
      const point = transform.transformPoint(new this.#pc.Vec3(x, y, z));
      const surfaceHeight = this.#surfaceHeightAt(
        point.x,
        point.z,
        maximumSurfaceHeight,
      );
      return Number.isFinite(surfaceHeight)
        ? [{ point, surfaceHeight }]
        : [];
    });
  }
}
