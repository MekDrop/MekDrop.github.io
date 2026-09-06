import kingModelUrl from "../../models/castle/royals/king.glb?url";
import princessModelUrl from "../../models/castle/royals/princess.glb?url";
import queenModelUrl from "../../models/castle/royals/queen.glb?url";

const MODEL_URLS = Object.freeze([
  kingModelUrl,
  queenModelUrl,
  princessModelUrl,
]);
const WALK_OUT_ANIMATION = "WalkOut";
const CRY_ANIMATION = "Cry";
const WALK_OUT_ANIMATION_SPEED = 1.8;
const WALK_OUT_DURATION = 3.2 / WALK_OUT_ANIMATION_SPEED;
const WALK_START_DELAY = 0.08;
const FALLBACK_VISUAL_SIZE = Object.freeze({ x: 1.2, y: 2.2, z: 1.2 });

/** An imported seated royal whose local +Z axis faces the visitor. */
export class SeatedRoyal {
  static get modelUrls() {
    return MODEL_URLS;
  }

  #entity;
  #performance = null;

  constructor({ modelUrl = kingModelUrl, modelLibrary }) {
    this.#entity = modelLibrary.instantiate(modelUrl);
    this.#entity.name = "Seated royal";
    const tracks = modelLibrary.getAnimationTracks(modelUrl, [
      WALK_OUT_ANIMATION,
      CRY_ANIMATION,
    ]);
    this.#entity.addComponent("anim", { activate: true });
    this.#entity.anim.addAnimationState(
      WALK_OUT_ANIMATION,
      tracks.get(WALK_OUT_ANIMATION),
      WALK_OUT_ANIMATION_SPEED,
      false,
    );
    this.#entity.anim.addAnimationState(
      CRY_ANIMATION,
      tracks.get(CRY_ANIMATION),
      1,
      true,
    );
  }

  get entity() {
    return this.#entity;
  }

  get visualBounds() {
    let minimumX = Number.POSITIVE_INFINITY;
    let minimumY = Number.POSITIVE_INFINITY;
    let minimumZ = Number.POSITIVE_INFINITY;
    let maximumX = Number.NEGATIVE_INFINITY;
    let maximumY = Number.NEGATIVE_INFINITY;
    let maximumZ = Number.NEGATIVE_INFINITY;

    for (const render of this.#entity.findComponents("render")) {
      for (const meshInstance of render.meshInstances) {
        const { center, halfExtents } = meshInstance.aabb;
        minimumX = Math.min(minimumX, center.x - halfExtents.x);
        minimumY = Math.min(minimumY, center.y - halfExtents.y);
        minimumZ = Math.min(minimumZ, center.z - halfExtents.z);
        maximumX = Math.max(maximumX, center.x + halfExtents.x);
        maximumY = Math.max(maximumY, center.y + halfExtents.y);
        maximumZ = Math.max(maximumZ, center.z + halfExtents.z);
      }
    }

    if (!Number.isFinite(minimumX)) {
      const position = this.#entity.getPosition();
      return {
        center: {
          x: position.x,
          y: position.y + FALLBACK_VISUAL_SIZE.y / 2,
          z: position.z,
        },
        size: { ...FALLBACK_VISUAL_SIZE },
      };
    }

    return {
      center: {
        x: (minimumX + maximumX) / 2,
        y: (minimumY + maximumY) / 2,
        z: (minimumZ + maximumZ) / 2,
      },
      size: {
        x: maximumX - minimumX,
        y: maximumY - minimumY,
        z: maximumZ - minimumZ,
      },
    };
  }

  beginGameOver({ startPosition, endPosition, getCameraPosition }) {
    if (this.#performance) {
      return;
    }
    this.#performance = {
      elapsed: 0,
      phase: "walking",
      startPosition: { ...startPosition },
      endPosition: { ...endPosition },
      getCameraPosition,
    };
    this.#face(
      endPosition.x - startPosition.x,
      endPosition.z - startPosition.z,
    );
    this.#entity.anim.baseLayer.play(WALK_OUT_ANIMATION);
  }

  update(deltaTime) {
    if (this.#performance?.phase !== "walking") {
      return;
    }
    const performance = this.#performance;
    performance.elapsed += deltaTime;
    const travelProgress = Math.max(
      0,
      Math.min(
        1,
        (performance.elapsed - WALK_START_DELAY) /
          (WALK_OUT_DURATION - WALK_START_DELAY),
      ),
    );
    const easedProgress =
      travelProgress * travelProgress * (3 - 2 * travelProgress);
    const start = performance.startPosition;
    const end = performance.endPosition;
    this.#entity.setLocalPosition(
      start.x + (end.x - start.x) * easedProgress,
      start.y + (end.y - start.y) * easedProgress,
      start.z + (end.z - start.z) * easedProgress,
    );
    if (travelProgress < 1) {
      return;
    }

    performance.phase = "crying";
    const cameraPosition = performance.getCameraPosition?.();
    if (cameraPosition) {
      this.#face(cameraPosition.x - end.x, cameraPosition.z - end.z);
    }
    this.#entity.anim.baseLayer.transition(CRY_ANIMATION, 0.18);
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#performance = null;
  }

  #face(x, z) {
    if (Math.hypot(x, z) <= 0.001) {
      return;
    }
    this.#entity.setLocalEulerAngles(
      0,
      (Math.atan2(x, z) * 180) / Math.PI,
      0,
    );
  }
}
