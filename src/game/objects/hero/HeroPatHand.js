import pattingHandModelUrl from "../../models/hero/patting-hand.glb?url";

const PAT_ANIMATION = "Pat";
const PAT_PLAYBACK_SPEED = 1;
const MODEL_SCALE = 0.75;
const COLLIDER_HALF_EXTENTS = Object.freeze({ x: 0.31, y: 0.05, z: 0.34 });
const PAT_CONTACT_TIMES = [
  10 / 24 / PAT_PLAYBACK_SPEED,
  16 / 24 / PAT_PLAYBACK_SPEED,
];

export class HeroPatHand {
  #entity;
  #model;
  #animationLayer;
  #animationDuration;
  #contactSource;
  #contactCollider;
  #elapsed = 0;
  #contactIndex = 0;
  #getPatPosition;
  #getViewRotation;
  #onContact;

  constructor({
    pc,
    modelLibrary,
    getPatPosition,
    getViewRotation,
    onContact,
  }) {
    this.#getPatPosition = getPatPosition;
    this.#getViewRotation = getViewRotation;
    this.#onContact = onContact;
    this.#entity = new pc.Entity("Hero patting hand");
    this.#model = modelLibrary.instantiate(HeroPatHand.modelUrl);
    const track = modelLibrary.getAnimationTracks(HeroPatHand.modelUrl, [
      PAT_ANIMATION,
    ]).get(PAT_ANIMATION);
    this.#model.addComponent("anim", { activate: true });
    this.#model.anim.addAnimationState(PAT_ANIMATION, track, 1, false);
    this.#model.anim.speed = PAT_PLAYBACK_SPEED;
    this.#model.setLocalScale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
    this.#contactSource = this.#findModelEntity("Patting hand animation rig");
    this.#animationLayer = this.#model.anim.baseLayer;
    this.#animationDuration = track.duration / PAT_PLAYBACK_SPEED;
    this.#entity.addChild(this.#model);
    this.#contactCollider = new pc.Entity("Hero patting hand collider");
    this.#contactCollider.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(
        COLLIDER_HALF_EXTENTS.x,
        COLLIDER_HALF_EXTENTS.y,
        COLLIDER_HALF_EXTENTS.z,
      ),
    });
    this.#contactCollider.addComponent("rigidbody", {
      type: pc.BODYTYPE_KINEMATIC,
      friction: 0,
      restitution: 0,
      group: pc.BODYGROUP_USER_4,
      mask: pc.BODYGROUP_USER_3,
    });
    this.#entity.addChild(this.#contactCollider);
    this.#entity.enabled = false;
  }

  static get modelUrl() {
    return pattingHandModelUrl;
  }

  get entity() {
    return this.#entity;
  }

  pat() {
    if (this.#entity.enabled) {
      return false;
    }
    if (!this.#placeAtPatPosition()) {
      return false;
    }
    this.#elapsed = 0;
    this.#contactIndex = 0;
    this.#entity.enabled = true;
    this.#animationLayer.play(PAT_ANIMATION);
    this.#syncContactCollider();
    return true;
  }

  update(deltaTime) {
    if (!this.#entity.enabled) {
      return;
    }
    this.#elapsed += Math.max(0, deltaTime);
    this.#syncContactCollider();
    while (
      this.#contactIndex < PAT_CONTACT_TIMES.length &&
      this.#elapsed >= PAT_CONTACT_TIMES[this.#contactIndex]
    ) {
      this.#onContact?.();
      this.#contactIndex += 1;
    }
    if (this.#elapsed >= this.#animationDuration) {
      this.#hide();
    }
  }

  destroy() {
    this.#entity?.destroy();
    this.#entity = null;
    this.#model = null;
    this.#contactSource = null;
    this.#contactCollider = null;
    this.#animationLayer = null;
    this.#getPatPosition = null;
    this.#getViewRotation = null;
    this.#onContact = null;
  }

  #placeAtPatPosition() {
    const position = this.#getPatPosition?.();
    if (!position || !this.#entity) {
      return false;
    }
    this.#entity.setPosition(position);
    this.#entity.setEulerAngles(
      0,
      45 + (this.#getViewRotation?.() ?? 0) * 90,
      0,
    );
    return true;
  }

  #findModelEntity(name) {
    const pending = [this.#model];
    while (pending.length) {
      const entity = pending.pop();
      if (entity.name === name) {
        return entity;
      }
      pending.push(...entity.children);
    }
    return this.#model;
  }

  #syncContactCollider() {
    this.#contactCollider.setPosition(this.#contactSource.getPosition());
    this.#contactCollider.setRotation(this.#contactSource.getRotation());
  }

  #hide() {
    this.#elapsed = 0;
    this.#contactIndex = 0;
    this.#entity.enabled = false;
  }
}
