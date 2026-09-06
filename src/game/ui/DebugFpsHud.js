const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const LEFT_MARGIN = 14;
const BOTTOM_MARGIN = 156;
const COUNTER_WIDTH = 214;
const COUNTER_HEIGHT = 84;
const TEXTURE_SCALE = 3;
const TEXT_PADDING_X = 10;
const FPS_COLUMN_X = 98;
const MEMORY_COLUMN_X = COUNTER_WIDTH - TEXT_PADDING_X;
const HEADER_BASELINE = 11;
const ROW_BASELINES = Object.freeze([31, 52, 73]);
const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEMORY_SAMPLE_INTERVAL = 1000;

export class DebugFpsHud {
  #pc;
  #app;
  #entity;
  #texture;
  #canvas;
  #context;
  #updateHandle;
  #framesPerSecond = 0;
  #minimumFramesPerSecond = Number.POSITIVE_INFINITY;
  #maximumFramesPerSecond = 0;
  #usedMemory = null;
  #minimumUsedMemory = Number.POSITIVE_INFINITY;
  #maximumUsedMemory = Number.NEGATIVE_INFINITY;
  #framesSinceSample = 0;
  #fpsSampleStartedAt = 0;
  #lastMemorySampleTime = 0;

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Debug FPS HUD");
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority: 105,
    });

    this.#canvas = document.createElement("canvas");
    this.#canvas.width = COUNTER_WIDTH * TEXTURE_SCALE;
    this.#canvas.height = COUNTER_HEIGHT * TEXTURE_SCALE;
    this.#context = this.#canvas.getContext("2d");
    this.#context.scale(TEXTURE_SCALE, TEXTURE_SCALE);
    this.#texture = new pc.Texture(app.graphicsDevice, {
      name: "Debug FPS counter texture",
      width: this.#canvas.width,
      height: this.#canvas.height,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    });

    const counter = new pc.Entity("Debug FPS counter");
    counter.addComponent("element", {
      type: pc.ELEMENTTYPE_IMAGE,
      anchor: new pc.Vec4(0, 0, 0, 0),
      pivot: new pc.Vec2(0, 0),
      width: COUNTER_WIDTH,
      height: COUNTER_HEIGHT,
      color: new pc.Color(1, 1, 1),
      useInput: false,
    });
    counter.element.texture = this.#texture;
    counter.setLocalPosition(LEFT_MARGIN, BOTTOM_MARGIN, 0);
    this.#entity.addChild(counter);
    this.#entity.screen.syncDrawOrder();
    this.#entity.enabled = false;
    this.#updateHandle = app.on("update", this.#update);
  }

  attach(parent = this.#app.root) {
    if (!this.#entity || this.#entity.parent === parent) return;
    parent.addChild(this.#entity);
  }

  resize(width, height) {
    if (!this.#entity?.screen) return;
    this.#entity.screen.referenceResolution = new this.#pc.Vec2(
      Math.max(1, width),
      Math.max(1, height),
    );
  }

  get framesPerSecond() {
    return this.#framesPerSecond;
  }

  setVisible(visible) {
    if (!this.#entity) return;
    const nextVisible = Boolean(visible);
    const beginsMeasurement = nextVisible && !this.#entity.enabled;
    this.#entity.enabled = nextVisible;
    if (!beginsMeasurement) return;
    this.#framesPerSecond = 0;
    this.#minimumFramesPerSecond = Number.POSITIVE_INFINITY;
    this.#maximumFramesPerSecond = 0;
    this.#usedMemory = null;
    this.#minimumUsedMemory = Number.POSITIVE_INFINITY;
    this.#maximumUsedMemory = Number.NEGATIVE_INFINITY;
    this.#framesSinceSample = 0;
    this.#fpsSampleStartedAt = performance.now();
    this.#lastMemorySampleTime = 0;
    this.#syncMetrics(true);
  }

  destroy() {
    this.#updateHandle?.off();
    this.#updateHandle = null;
    this.#entity?.destroy();
    this.#texture?.destroy();
    this.#entity = null;
    this.#texture = null;
    this.#canvas = null;
    this.#context = null;
    this.#app = null;
    this.#pc = null;
  }

  #update = () => {
    if (this.#entity?.enabled) this.#syncMetrics();
  };

  #syncMetrics(force = false) {
    const now = performance.now();
    let framesPerSecondChanged = false;
    if (!force) {
      this.#framesSinceSample += 1;
      const elapsed = now - this.#fpsSampleStartedAt;
      if (elapsed >= 1000) {
        const framesPerSecond = Math.max(
          0,
          Math.round((this.#framesSinceSample * 1000) / elapsed),
        );
        framesPerSecondChanged = framesPerSecond !== this.#framesPerSecond;
        this.#framesPerSecond = framesPerSecond;
        this.#framesSinceSample = 0;
        this.#fpsSampleStartedAt = now;
        if (framesPerSecond > 0) {
          this.#minimumFramesPerSecond = Math.min(
            this.#minimumFramesPerSecond,
            framesPerSecond,
          );
          this.#maximumFramesPerSecond = Math.max(
            this.#maximumFramesPerSecond,
            framesPerSecond,
          );
        }
      }
    }
    const shouldSampleMemory =
      force || now - this.#lastMemorySampleTime >= MEMORY_SAMPLE_INTERVAL;
    let memoryChanged = false;
    if (shouldSampleMemory) {
      this.#lastMemorySampleTime = now;
      const usedMemory = this.#readUsedMemory();
      memoryChanged = usedMemory !== this.#usedMemory;
      this.#usedMemory = usedMemory;
      if (usedMemory !== null) {
        this.#minimumUsedMemory = Math.min(
          this.#minimumUsedMemory,
          usedMemory,
        );
        this.#maximumUsedMemory = Math.max(
          this.#maximumUsedMemory,
          usedMemory,
        );
      }
    }
    if (
      !force &&
      !framesPerSecondChanged &&
      !memoryChanged
    ) {
      return;
    }
    this.#draw();
  }

  #readUsedMemory() {
    const usedBytes = performance.memory?.usedJSHeapSize;
    if (!Number.isFinite(usedBytes)) return null;
    return Math.round((usedBytes / BYTES_PER_MEGABYTE) * 10) / 10;
  }

  #formatMemory(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)} MB` : "--";
  }

  #draw() {
    const context = this.#context;
    context.clearRect(0, 0, COUNTER_WIDTH, COUNTER_HEIGHT);

    context.beginPath();
    context.roundRect(0.5, 0.5, COUNTER_WIDTH - 1, COUNTER_HEIGHT - 1, 12);
    context.fillStyle = "rgba(3, 10, 8, 0.72)";
    context.fill();
    context.strokeStyle = "rgba(210, 244, 228, 0.22)";
    context.lineWidth = 1;
    context.stroke();

    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = "#071522";
    context.lineWidth = 3.5;

    context.textAlign = "right";
    context.font = "800 10px Arial, sans-serif";
    context.fillStyle = "#ffffff";
    context.strokeText("FPS", FPS_COLUMN_X, HEADER_BASELINE);
    context.fillText("FPS", FPS_COLUMN_X, HEADER_BASELINE);
    context.strokeText("MEMORY", MEMORY_COLUMN_X, HEADER_BASELINE);
    context.fillText("MEMORY", MEMORY_COLUMN_X, HEADER_BASELINE);

    const rows = [
      ["CURRENT", this.#framesPerSecond, this.#usedMemory, "#ffffff"],
      [
        "MIN",
        Number.isFinite(this.#minimumFramesPerSecond)
          ? this.#minimumFramesPerSecond
          : "--",
        this.#minimumUsedMemory,
        "#9feaff",
      ],
      [
        "MAX",
        this.#maximumFramesPerSecond || "--",
        this.#maximumUsedMemory,
        "#ffd37e",
      ],
    ];
    rows.forEach(([label, framesPerSecond, usedMemory, color], index) => {
      const y = ROW_BASELINES[index];
      context.textAlign = "left";
      context.font = "800 10px Arial, sans-serif";
      context.strokeText(label, TEXT_PADDING_X, y);
      context.fillStyle = color;
      context.fillText(label, TEXT_PADDING_X, y);

      context.textAlign = "right";
      context.font = "900 16px Arial, sans-serif";
      context.strokeText(framesPerSecond, FPS_COLUMN_X, y);
      context.fillText(framesPerSecond, FPS_COLUMN_X, y);

      const memory = this.#formatMemory(usedMemory);
      context.strokeText(memory, MEMORY_COLUMN_X, y);
      context.fillText(memory, MEMORY_COLUMN_X, y);
    });
    this.#texture.setSource(this.#canvas);
  }
}
