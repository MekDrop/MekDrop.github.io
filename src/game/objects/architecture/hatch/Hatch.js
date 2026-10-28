import { CastleAudio } from "../../../audio/castle/CastleAudio.js";
import { GameObjectAudio } from "../../../audio/GameObjectAudio.js";
import { HatchInteraction } from "./HatchInteraction.js";
import lockUrl from "../../../models/architecture/hatch/rim-lock.glb?url";
import keeperUrl from "../../../models/architecture/hatch/rim-lock-keeper.glb?url";
import frameUrl from "../../../models/architecture/hatch/oak-hatch-frame.glb?url";
import hatchUrl from "../../../models/architecture/hatch/oak-hatch-lid.glb?url";
import { AbstractCastleProp } from "../../shared/AbstractCastleProp.js";

/**
 * Independent framed timber hatch, optionally paired with a ladder by id.
 */
export class Hatch extends AbstractCastleProp {
  /**
   * @type {GameObjectAudio|undefined}
   */
  #audio;
  /**
   * @returns {string[]}
   */
  static get audioUrls() {
    return [CastleAudio.doorOpen.wavUrl, CastleAudio.doorClose.wavUrl, CastleAudio.latch.wavUrl];
  }
  /**
   * @type {import("playcanvas").Entity}
   */
  #hatch;
  /**
   * @type {import("playcanvas").Entity}
   */
  #hatchCollider;
  /**
   * @type {ReturnType<typeof setTimeout>}
   */
  #closeTimer;
  /**
   * @type {import("playcanvas").Entity}
   */
  #lockBolt;
  /**
   * @returns {string[]}
   */
  static get modelUrls() {
    return [hatchUrl, frameUrl, lockUrl, keeperUrl];
  }
  /**
   * @returns {string}
   */
  static get modelUrl() {
    return hatchUrl;
  }
  /**
   * @returns {boolean}
   */
  static get hasAuthoredCollision() {
    return false;
  }
  /**
   * @param {ConstructorParameters<typeof AbstractCastleProp>[0]} options
   */
  constructor(options) {
    super(options);

    const { pc, modelLibrary, definition } = options;
    if (options.runtime?.audioLibrary) {
      this.#audio = new GameObjectAudio(this.visualRoots[0], options.app ?? pc.Application.getApplication(), options.runtime.audioLibrary, {
        open: CastleAudio.doorOpen,
        close: CastleAudio.doorClose,
        latch: CastleAudio.latch,
      }, 0.35);
      this.#audio.follow(() => options.runtime.objects.getOne("hero")?.position ?? null);
    }
    const hatch = {
      width: 1,
      depth: 1,
      ...definition,
    };
    const x = 0, z = 0;
    this.#hatch = new pc.Entity("Tower roof hatch hinge");
    this.visualRoots[0].addChild(this.#hatch);
    this.#hatch.setLocalPosition(x, 0, z - hatch.depth / 2);
    // Four reused timber modules form a fixed frame outside the clear opening.
    this.#addHatchFrame(
      modelLibrary,
      x,
      hatch,
      definition,
      z,
      -hatch.width / 2 - 0.01,
      0,
      0.1,
      hatch.depth + 0.12,
    );
    this.#addHatchFrame(
      modelLibrary,
      x,
      hatch,
      definition,
      z,
      hatch.width / 2 + 0.01,
      0,
      0.1,
      hatch.depth + 0.12,
    );
    this.#addHatchFrame(
      modelLibrary,
      x,
      hatch,
      definition,
      z,
      0,
      -hatch.depth / 2 - 0.01,
      hatch.width,
      0.1,
    );
    this.#addHatchFrame(
      modelLibrary,
      x,
      hatch,
      definition,
      z,
      0,
      hatch.depth / 2 + 0.01,
      hatch.width,
      0.1,
    );
    const panel = this.visualRoots[0].children[0];
    panel.reparent(this.#hatch);
    panel.setLocalPosition(0, 0, hatch.depth / 2);
    const lock = modelLibrary.instantiate(lockUrl);
    lock.name = "Hatch iron rim lock";
    lock.setLocalPosition(0.23, -0.0925, hatch.depth - 0.14);
    this.#hatch.addChild(lock);
    this.#lockBolt = lock.findByName("Sliding hatch lock bolt");
    this.#lockBolt.enabled = this.locked;
    const keeper = modelLibrary.instantiate(keeperUrl);
    keeper.name = "Hatch fixed lock keeper";
    keeper.setLocalPosition(0.23, -0.1175, hatch.depth / 2 - 0.04);
    this.visualRoots[0].addChild(keeper);
    this.#hatchCollider = new pc.Entity("Closed tower hatch support");
    this.#hatch.addChild(this.#hatchCollider);
    this.#hatchCollider.setLocalPosition(0, -0.055, hatch.depth / 2);
    this.#hatchCollider.addComponent("collision", {
      type: "box",
      halfExtents: new pc.Vec3(hatch.width / 2, 0.0375, hatch.depth / 2),
    });
    this.#hatchCollider.addComponent("rigidbody", {
      type: "static",
      friction: 0.6,
    });
  }

  /**
   * @param {import("playcanvas").Entity} model
   */
  prepareModel(model) {
    model.setLocalScale((this.definition.width ?? 1) - 0.01, 1, (this.definition.depth ?? 1) - 0.01);
  }
  /**
   * @returns {boolean}
   */
  get locked() {
    return this.definition.locked === true;
  }
  /**
   * @param {boolean} value
   */
  set locked(value) {
    if (this.locked !== value) {
      this.#audio?.play("latch");
    }
    this.definition.locked = value;
    // The retracted bolt is concealed inside the opaque lock case.
    this.#lockBolt.enabled = value;
    if (value) {
      this.#setTimeout();
    }
  }
  /**
   * @returns {boolean}
   */
  open() {
    if (this.locked) {
      this.#audio?.resume();
      this.#audio?.play("latch");

      return false;
    }
    this.#audio?.resume();
    if (this.#hatchCollider.enabled) {
      this.#audio?.play("open");
    }
    clearTimeout(this.#closeTimer);
    this.#hatchCollider.enabled = false;
    this.#hatch.setLocalEulerAngles(-100, 0, 0);
    this.#closeTimer = setTimeout(this.#setTimeout.bind(this), 2000);

    return true;
  }
  /**
   * @param {{hero:import("../../characters/hero/Hero.js").Hero,onComplete?:()=>void}} options
   * @returns {HatchInteraction|null}
   */
  findInteraction({ hero, onComplete }) {
    const interaction = new HatchInteraction(this, hero, onComplete);

    return interaction.canInteract ? interaction : null;
  }
  onSceneReady() {}
  destroy() {
    clearTimeout(this.#closeTimer); super.destroy();
  }
  #setTimeout() {
    if (!this.#hatchCollider.enabled) {
      this.#audio?.play("close");
    }
    this.#hatch.setLocalEulerAngles(0, 0, 0);
    this.#hatchCollider.enabled = true;
  }

  /**
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
   * @param {number} x
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} hatch
   * @param {import("../../ObjectTypes.js").MapObjectDefinition} definition
   * @param {number} z
   * @param {number} offsetX
   * @param {number} offsetZ
   * @param {number} width
   * @param {number} depth
   */
  #addHatchFrame(
    modelLibrary,
    x,
    hatch,
    definition,
    z,
    offsetX,
    offsetZ,
    width,
    depth,
  ) {
    const frame = modelLibrary.instantiate(frameUrl);
    frame.name = "Tower hatch fixed oak frame";
    frame.setLocalScale(width, 1, depth);
    frame.setLocalPosition(x + offsetX, hatch.position.y - definition.position.y - 0.04, z + offsetZ);
    this.visualRoots[0].addChild(frame);
  }

}
