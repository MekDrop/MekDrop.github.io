const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const LEFT_MARGIN = 14;
const BOTTOM_MARGIN = 156;
const COUNTER_WIDTH = 214;
const COUNTER_HEIGHT = 158;
const TEXTURE_SCALE = 3;
const TEXT_PADDING_X = 10;
const FPS_COLUMN_X = 98;
const MEMORY_COLUMN_X = COUNTER_WIDTH - TEXT_PADDING_X;
const HEADER_BASELINE = 11;
const ROW_BASELINES = Object.freeze([31, 52, 73]);
const GRAPH_LEFT = 31;
const GRAPH_RIGHT = COUNTER_WIDTH - 8;
const GRAPH_TOP = 91;
const GRAPH_BOTTOM = COUNTER_HEIGHT - 19;
const GRAPH_TIME_BASELINE = COUNTER_HEIGHT - 7;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const MEMORY_SAMPLE_INTERVAL = 1000;
const FPS_WINDOW_DURATION = 5 * 60 * 1000;
const HUD_REFRESH_INTERVAL = 250;
const GRAPH_SAMPLE_INTERVAL = 250;
const GRAPH_GAP_THRESHOLD = GRAPH_SAMPLE_INTERVAL * 3;
const GRAPH_AXIS_STEP = 15;
const DEQUE_COMPACTION_THRESHOLD = 1024;

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
  #lastFrameTime = 0;
  #lastHudRefreshTime = 0;
  #lastMemorySampleTime = 0;
  #minimumFrameSamples = [];
  #minimumFrameSampleHead = 0;
  #maximumFrameSamples = [];
  #maximumFrameSampleHead = 0;
  #graphSamples = [];
  #graphSampleHead = 0;

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
      mipmaps: false,
      minFilter: pc.FILTER_LINEAR,
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
    if (!this.#entity || this.#entity.parent === parent) {
      return;
    }
    parent.addChild(this.#entity);
  }

  resize(width, height) {
    if (!this.#entity?.screen) {
      return;
    }
    this.#entity.screen.referenceResolution = new this.#pc.Vec2(
      Math.max(1, width),
      Math.max(1, height),
    );
  }

  get framesPerSecond() {
    return this.#framesPerSecond;
  }

  set visible(visible) {
    if (!this.#entity) {
      return;
    }
    const nextVisible = Boolean(visible);
    const beginsMeasurement = nextVisible && !this.#entity.enabled;
    this.#entity.enabled = nextVisible;
    if (!beginsMeasurement) {
      return;
    }
    this.#framesPerSecond = 0;
    this.#minimumFramesPerSecond = Number.POSITIVE_INFINITY;
    this.#maximumFramesPerSecond = 0;
    this.#usedMemory = null;
    this.#minimumUsedMemory = Number.POSITIVE_INFINITY;
    this.#maximumUsedMemory = Number.NEGATIVE_INFINITY;
    this.#lastFrameTime = performance.now();
    this.#lastHudRefreshTime = 0;
    this.#lastMemorySampleTime = 0;
    this.#minimumFrameSamples = [];
    this.#minimumFrameSampleHead = 0;
    this.#maximumFrameSamples = [];
    this.#maximumFrameSampleHead = 0;
    this.#graphSamples = [];
    this.#graphSampleHead = 0;
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
    if (this.#entity?.enabled) {
      this.#syncMetrics();
    }
  };

  #syncMetrics(force = false) {
    const now = performance.now();
    if (!force) {
      this.#sampleFrameRate(now);
    }
    const shouldSampleMemory =
      force || now - this.#lastMemorySampleTime >= MEMORY_SAMPLE_INTERVAL;
    if (shouldSampleMemory) {
      this.#lastMemorySampleTime = now;
      const usedMemory = this.#readUsedMemory();
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
    if (!force && now - this.#lastHudRefreshTime < HUD_REFRESH_INTERVAL) {
      return;
    }
    this.#lastHudRefreshTime = now;
    this.#draw();
  }

  #sampleFrameRate(now) {
    const elapsed = now - this.#lastFrameTime;
    this.#lastFrameTime = now;
    if (!Number.isFinite(elapsed) || elapsed <= 0) {
      return;
    }

    const sample = {
      time: now,
      framesPerSecond: Math.max(0, Math.round(1000 / elapsed)),
    };
    this.#framesPerSecond = sample.framesPerSecond;
    this.#appendMinimumSample(sample);
    this.#appendMaximumSample(sample);
    this.#appendGraphSample(sample);
    this.#expireFrameSamples(now - FPS_WINDOW_DURATION);
    this.#minimumFramesPerSecond =
      this.#minimumFrameSamples[this.#minimumFrameSampleHead]
        ?.framesPerSecond ?? Number.POSITIVE_INFINITY;
    this.#maximumFramesPerSecond =
      this.#maximumFrameSamples[this.#maximumFrameSampleHead]
        ?.framesPerSecond ?? 0;
  }

  #appendMinimumSample(sample) {
    while (
      this.#minimumFrameSamples.length > this.#minimumFrameSampleHead &&
      this.#minimumFrameSamples[this.#minimumFrameSamples.length - 1]
        .framesPerSecond >= sample.framesPerSecond
    ) {
      this.#minimumFrameSamples.pop();
    }
    this.#minimumFrameSamples.push(sample);
  }

  #appendMaximumSample(sample) {
    while (
      this.#maximumFrameSamples.length > this.#maximumFrameSampleHead &&
      this.#maximumFrameSamples[this.#maximumFrameSamples.length - 1]
        .framesPerSecond <= sample.framesPerSecond
    ) {
      this.#maximumFrameSamples.pop();
    }
    this.#maximumFrameSamples.push(sample);
  }

  #appendGraphSample(sample) {
    const latestSample = this.#graphSamples[this.#graphSamples.length - 1];
    if (
      latestSample &&
      sample.time - latestSample.startedAt < GRAPH_SAMPLE_INTERVAL
    ) {
      latestSample.time = sample.time;
      latestSample.framesPerSecond = Math.min(
        latestSample.framesPerSecond,
        sample.framesPerSecond,
      );
      return;
    }

    this.#graphSamples.push({
      startedAt: sample.time,
      time: sample.time,
      framesPerSecond: sample.framesPerSecond,
    });
  }

  #expireFrameSamples(cutoff) {
    while (
      this.#minimumFrameSampleHead < this.#minimumFrameSamples.length &&
      this.#minimumFrameSamples[this.#minimumFrameSampleHead].time < cutoff
    ) {
      this.#minimumFrameSampleHead += 1;
    }
    while (
      this.#maximumFrameSampleHead < this.#maximumFrameSamples.length &&
      this.#maximumFrameSamples[this.#maximumFrameSampleHead].time < cutoff
    ) {
      this.#maximumFrameSampleHead += 1;
    }
    while (
      this.#graphSampleHead < this.#graphSamples.length &&
      this.#graphSamples[this.#graphSampleHead].time < cutoff
    ) {
      this.#graphSampleHead += 1;
    }
    this.#compactFrameSampleDeques();
  }

  #compactFrameSampleDeques() {
    if (this.#minimumFrameSampleHead >= DEQUE_COMPACTION_THRESHOLD) {
      this.#minimumFrameSamples = this.#minimumFrameSamples.slice(
        this.#minimumFrameSampleHead,
      );
      this.#minimumFrameSampleHead = 0;
    }
    if (this.#maximumFrameSampleHead >= DEQUE_COMPACTION_THRESHOLD) {
      this.#maximumFrameSamples = this.#maximumFrameSamples.slice(
        this.#maximumFrameSampleHead,
      );
      this.#maximumFrameSampleHead = 0;
    }
    if (this.#graphSampleHead >= DEQUE_COMPACTION_THRESHOLD) {
      this.#graphSamples = this.#graphSamples.slice(this.#graphSampleHead);
      this.#graphSampleHead = 0;
    }
  }

  #readUsedMemory() {
    const usedBytes = performance.memory?.usedJSHeapSize;
    if (!Number.isFinite(usedBytes)) {
      return null;
    }
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
    context.strokeText("FPS 5M", FPS_COLUMN_X, HEADER_BASELINE);
    context.fillText("FPS 5M", FPS_COLUMN_X, HEADER_BASELINE);
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
    this.#drawFrameRateGraph(context);
    this.#texture.setSource(this.#canvas);
  }

  #drawFrameRateGraph(context) {
    const axisMaximum = Math.max(
      GRAPH_AXIS_STEP * 2,
      Math.ceil(this.#maximumFramesPerSecond / GRAPH_AXIS_STEP) *
        GRAPH_AXIS_STEP,
    );
    const axisValues = [axisMaximum, Math.round(axisMaximum / 2), 0];
    const axisPositions = [GRAPH_TOP, (GRAPH_TOP + GRAPH_BOTTOM) / 2, GRAPH_BOTTOM];

    context.fillStyle = "rgba(1, 8, 6, 0.42)";
    context.fillRect(
      GRAPH_LEFT,
      GRAPH_TOP,
      GRAPH_RIGHT - GRAPH_LEFT,
      GRAPH_BOTTOM - GRAPH_TOP,
    );
    context.font = "700 7px monospace";
    context.textAlign = "right";
    context.textBaseline = "middle";
    axisValues.forEach((value, index) => {
      const y = axisPositions[index];
      context.beginPath();
      context.moveTo(GRAPH_LEFT, y);
      context.lineTo(GRAPH_RIGHT, y);
      context.strokeStyle = "rgba(210, 244, 228, 0.15)";
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = "rgba(220, 242, 230, 0.72)";
      context.fillText(String(value), GRAPH_LEFT - 4, y);
    });

    const now = performance.now();
    const windowStartedAt = now - FPS_WINDOW_DURATION;
    const graphWidth = GRAPH_RIGHT - GRAPH_LEFT;
    const graphHeight = GRAPH_BOTTOM - GRAPH_TOP;
    const getX = (time) =>
      GRAPH_LEFT +
      ((time - windowStartedAt) / FPS_WINDOW_DURATION) * graphWidth;
    const getY = (framesPerSecond) =>
      GRAPH_BOTTOM -
      (Math.min(axisMaximum, Math.max(0, framesPerSecond)) / axisMaximum) *
        graphHeight;

    context.save();
    context.beginPath();
    context.rect(
      GRAPH_LEFT,
      GRAPH_TOP,
      graphWidth,
      graphHeight,
    );
    context.clip();
    context.beginPath();
    let previousSample = null;
    for (
      let index = this.#graphSampleHead;
      index < this.#graphSamples.length;
      index += 1
    ) {
      const sample = this.#graphSamples[index];
      const x = getX(sample.time);
      const y = getY(sample.framesPerSecond);
      if (
        !previousSample ||
        sample.startedAt - previousSample.time > GRAPH_GAP_THRESHOLD
      ) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
      previousSample = sample;
    }
    context.strokeStyle = "#9feaff";
    context.lineWidth = 1.25;
    context.lineJoin = "round";
    context.stroke();
    context.restore();

    context.font = "700 7px monospace";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(220, 242, 230, 0.68)";
    context.textAlign = "left";
    context.fillText(
      `-${this.#formatGraphDuration(FPS_WINDOW_DURATION)}`,
      GRAPH_LEFT,
      GRAPH_TIME_BASELINE,
    );
    context.textAlign = "center";
    context.fillText(
      `-${this.#formatGraphDuration(FPS_WINDOW_DURATION / 2)}`,
      (GRAPH_LEFT + GRAPH_RIGHT) / 2,
      GRAPH_TIME_BASELINE,
    );
    context.textAlign = "right";
    context.fillText("now", GRAPH_RIGHT, GRAPH_TIME_BASELINE);
  }

  #formatGraphDuration(duration) {
    if (duration >= 60 * 1000) {
      const minutes = duration / (60 * 1000);
      return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)}m`;
    }
    return `${Math.max(1, Math.round(duration / 1000))}s`;
  }
}
