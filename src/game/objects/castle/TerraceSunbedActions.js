import sunbedUrl from "../../models/castle/leisure/sunbed.glb?url";
import bookUrl from "../../models/castle/leisure/open-book.glb?url";
import { BOOK_ANIMATION } from "../../enum/BookAnimation.js";
import { CASTLE_TERRACE_PHASE as PHASE } from "../../enum/CastleTerracePhase.js";

const SUNBED_POSITION = [0, 0, 3.1];
const SUNBED_CARRY_OFFSET = [0, 0.55, 1.55];
const ease = (value) => value * value * (3 - 2 * value);

/**
 * Executes the sunbed and reading-prop actions requested by the queen.
 */
export class TerraceSunbedActions {
  static get modelUrls() {
    return [sunbedUrl, bookUrl];
  }

  #pc;
  #stage;
  #royal;
  #sunbed;
  #book;
  #bookOpenAmount = 0;
  #bookAnimationLayer;
  #bookAnimationDuration;

  constructor({ pc, modelLibrary, stage, royal }) {
    this.#pc = pc;
    this.#stage = stage;
    this.#royal = royal;
    this.#sunbed = modelLibrary.instantiate(sunbedUrl);
    this.#sunbed.name = "Terrace sunbed";
    stage.addChild(this.#sunbed);
    this.#book = modelLibrary.instantiate(bookUrl);
    this.#book.name = "Terrace book";
    stage.addChild(this.#book);
    this.#setupBookAnimation(modelLibrary);
  }

  get state() {
    return { bookOpenAmount: this.#bookOpenAmount };
  }

  sync(servantBehavior, royalBehavior, servant) {
    this.#syncSunbed(servantBehavior, servant);
    this.#syncBook(royalBehavior);
  }

  #syncSunbed(behavior, servant) {
    const phase = behavior.stagePhase;
    const moving = behavior.cargo === "sunbed" && [
      PHASE.SERVANT_ENTER,
      PHASE.FURNISH,
      PHASE.PACK,
      PHASE.SERVANT_LEAVE,
    ].includes(phase);
    const installed = behavior.installedCount > 0;
    this.#sunbed.enabled = installed || moving;
    this.#sunbed.setLocalPosition(...SUNBED_POSITION);
    this.#sunbed.setLocalEulerAngles(0, 0, 0);
    this.#sunbed.setLocalScale(1, 1, 1);
    if (!moving) {
      return;
    }
    const world = servant.entity.getWorldTransform().transformPoint(
      new this.#pc.Vec3(...SUNBED_CARRY_OFFSET),
    );
    const carry = this.#stage.getWorldTransform().clone().invert()
      .transformPoint(world);
    const progress = phase === PHASE.FURNISH
      ? ease(behavior.progress)
      : phase === PHASE.PACK ? 1 - ease(behavior.progress) : 0;
    this.#sunbed.setLocalPosition(
      carry.x + (SUNBED_POSITION[0] - carry.x) * progress,
      carry.y + (SUNBED_POSITION[1] - carry.y) * progress,
      carry.z + (SUNBED_POSITION[2] - carry.z) * progress,
    );
    this.#sunbed.setLocalRotation(new this.#pc.Quat().slerp(
      servant.entity.getLocalRotation(),
      new this.#pc.Quat(),
      progress,
    ));
    this.#sunbed.enabled = servant.entity.enabled;
  }

  #setupBookAnimation(modelLibrary) {
    const track = modelLibrary
      .getAnimationTracks(bookUrl, [BOOK_ANIMATION.OPEN])
      .get(BOOK_ANIMATION.OPEN);
    this.#book.addComponent("anim", { activate: true });
    this.#book.anim.addAnimationState(BOOK_ANIMATION.OPEN, track, 1, false);
    this.#book.anim.baseLayer.play(BOOK_ANIMATION.OPEN);
    this.#book.anim.speed = 0;
    this.#bookAnimationLayer = this.#book.anim.baseLayer;
    this.#bookAnimationDuration = track.duration;
    this.#setBookOpenAmount(0);
  }

  #syncBook(behavior) {
    const phase = behavior.stagePhase;
    const visible = [PHASE.ROYAL_ENTER, PHASE.SETTLE, PHASE.ACTIVITY,
      PHASE.RISE, PHASE.ROYAL_EXIT].includes(phase) &&
      this.#royal.entity.enabled;
    this.#book.enabled = visible;
    if (!visible) {
      this.#bookOpenAmount = 0;
      this.#setBookOpenAmount(0);
      return;
    }
    const mountProgress = phase === PHASE.SETTLE
      ? behavior.progress
      : phase === PHASE.ACTIVITY ? 1
        : phase === PHASE.RISE ? 1 - behavior.progress : 0;
    const raise = ease(Math.max(0, Math.min(1, (mountProgress - 0.58) / 0.28)));
    this.#bookOpenAmount = ease(Math.max(
      0,
      Math.min(1, (mountProgress - 0.78) / 0.22),
    ));
    const left = this.#royal.leftHand.getPosition().clone();
    const reading = left.clone().lerp(
      left,
      this.#royal.rightHand.getPosition(),
      0.5,
    );
    reading.add(this.#royal.entity.getWorldTransform().transformVector(
      new this.#pc.Vec3(0, 0.12, 0.08),
    ));
    const world = left.clone().lerp(left, reading, raise);
    const local = this.#stage.getWorldTransform().clone().invert()
      .transformPoint(world);
    this.#book.setLocalPosition(local.x, local.y + 0.035, local.z);
    this.#book.setLocalEulerAngles(-25 * raise, 0, 0);
    this.#setBookOpenAmount(this.#bookOpenAmount);
  }

  #setBookOpenAmount(amount) {
    this.#bookAnimationLayer.activeStateCurrentTime =
      this.#bookAnimationDuration * amount;
  }
}
