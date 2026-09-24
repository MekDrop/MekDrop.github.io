const CONTACT_EPSILON = 0.006;
const CONTACT_REACH = 0.14;
const MAXIMUM_FOOT_LIFT = 0.32;
const MAXIMUM_FOOT_TILT = 30;
const RELEASE_RESPONSE = 18;
const TILT_RESPONSE = 20;

export class HeroFootPlacement {
  #pc;
  #surfaceAt;
  #getHeroPosition;
  #feet;
  #enabled = false;

  constructor({ pc, surfaceAt, getHeroPosition, left, right }) {
    this.#pc = pc;
    this.#surfaceAt = surfaceAt;
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
        id: `hero-${foot.side}`,
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
        deltaTime,
      );
      const contacts = this.#contacts(foot, maximumSurfaceHeight);
      const targetLift = Math.min(
        MAXIMUM_FOOT_LIFT,
        Math.max(
          0,
          ...contacts.map(
            ({ solePoint, surface }) =>
              surface.height - solePoint.y + CONTACT_EPSILON,
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
              ({ solePoint, surface }) =>
                solePoint.y + foot.appliedLift - surface.height,
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
    // Pivot under the knee so the boot keeps its ankle offset and pose.
    cuff.parent.addChild(tilt);
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
    deltaTime,
  ) {
    const normal = this.#contactNormal(contacts);
    const targetWeight = normal ? 1 : 0;
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

  #contactNormal(contacts) {
    let x = 0;
    let y = 0;
    let z = 0;
    let totalWeight = 0;
    for (const { solePoint, surface } of contacts) {
      const distance = Math.abs(solePoint.y - surface.height);
      const weight = Math.max(0, 1 - distance / CONTACT_REACH);
      const normal = surface.normal;
      if (
        weight <= 0 ||
        !normal ||
        ![normal.x, normal.y, normal.z].every(Number.isFinite) ||
        normal.y <= 0
      ) {
        continue;
      }
      x += normal.x * weight;
      y += normal.y * weight;
      z += normal.z * weight;
      totalWeight += weight;
    }
    if (totalWeight <= 0) {
      return null;
    }

    const normal = new this.#pc.Vec3(
      x / totalWeight,
      y / totalWeight,
      z / totalWeight,
    ).normalize();
    const horizontalLength = Math.hypot(normal.x, normal.z);
    const maximumTilt = (MAXIMUM_FOOT_TILT * Math.PI) / 180;
    if (horizontalLength <= Math.sin(maximumTilt)) {
      return normal;
    }
    const horizontalScale = Math.sin(maximumTilt) / horizontalLength;
    return new this.#pc.Vec3(
      normal.x * horizontalScale,
      Math.cos(maximumTilt),
      normal.z * horizontalScale,
    );
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
      const solePoint = transform.transformPoint(new this.#pc.Vec3(x, y, z));
      const surface = this.#surfaceAt(
        solePoint.x,
        solePoint.z,
        maximumSurfaceHeight,
      );
      return surface &&
        Number.isFinite(surface.height) &&
        surface.normal &&
        surface.point
        ? [{ solePoint, surface }]
        : [];
    });
  }
}
