const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const PANEL_TEXTURE_SCALE = 4;

export class GamePanelHud {
  #pc;
  #app;
  #theme;
  #entity;
  #textures = new Set();

  constructor({ pc, app, theme, name, priority }) {
    this.#pc = pc;
    this.#app = app;
    this.#theme = theme;
    this.#entity = new pc.Entity(name);
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority,
    });
  }

  get pc() {
    return this.#pc;
  }

  get app() {
    return this.#app;
  }

  get theme() {
    return this.#theme;
  }

  get entity() {
    return this.#entity;
  }

  get root() {
    return this.#entity;
  }

  attach(parent = this.#app.root) {
    if (!this.#entity || this.#entity.parent === parent) {
      return;
    }
    parent.addChild(this.#entity);
  }

  set visible(visible) {
    if (this.#entity) {
      this.#entity.enabled = Boolean(visible);
    }
  }

  createPanel({ name, x, y, width, height }) {
    const panel = new this.#pc.Entity(name);
    panel.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_GROUP,
      anchor: new this.#pc.Vec4(0, 1, 0, 1),
      pivot: new this.#pc.Vec2(0, 1),
      width,
      height,
      useInput: false,
    });
    panel.setLocalPosition(x, -y, 0);
    this.#entity.addChild(panel);
    return panel;
  }

  createImage({ parent, name, x, y, width, height, texture, color = null }) {
    const options = {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0, 1, 0, 1),
      pivot: new this.#pc.Vec2(0, 1),
      width,
      height,
      useInput: false,
    };
    if (color !== null) {
      options.color = this.#theme.playCanvasColor(this.#pc, color);
    }

    const entity = new this.#pc.Entity(name);
    entity.addComponent("element", options);
    entity.element.texture = texture;
    entity.setLocalPosition(x, -y, 0);
    parent.addChild(entity);
    return entity;
  }

  createTextureRecord(name, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return {
      canvas,
      context: canvas.getContext("2d"),
      texture: this.createTexture(name, canvas),
    };
  }

  createDrawnTexture(name, width, height, draw) {
    const record = this.createTextureRecord(name, width, height);
    draw(record.context);
    record.texture.setSource(record.canvas);
    return record.texture;
  }

  createPanelTexture(name, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width * PANEL_TEXTURE_SCALE;
    canvas.height = height * PANEL_TEXTURE_SCALE;
    const context = canvas.getContext("2d");
    context.scale(PANEL_TEXTURE_SCALE, PANEL_TEXTURE_SCALE);
    this.drawPanelFrame(context, width, height);
    return this.createTexture(name, canvas);
  }

  createTexture(name, canvas, { mipmaps = false } = {}) {
    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      width: canvas.width,
      height: canvas.height,
      format: this.#pc.PIXELFORMAT_RGBA8,
      srgb: true,
      mipmaps,
      minFilter: mipmaps
        ? this.#pc.FILTER_LINEAR_MIPMAP_LINEAR
        : this.#pc.FILTER_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.name = name;
    texture.setSource(canvas);
    this.#textures.add(texture);
    return texture;
  }

  releaseTexture(texture) {
    if (!texture || !this.#textures.delete(texture)) {
      return;
    }
    texture.destroy();
  }

  drawPanelFrame(context, width, height) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, this.#theme.surfaceTop);
    gradient.addColorStop(1, this.#theme.surfaceBottom);
    this.roundedRect(context, 1.5, 1.5, width - 3, height - 3, 9);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = this.#theme.shadow;
    context.lineWidth = 3;
    context.stroke();
    this.roundedRect(context, 3.5, 3.5, width - 7, height - 7, 7);
    context.strokeStyle = this.#theme.withAlpha(this.#theme.outline, 0.72);
    context.lineWidth = 1;
    context.stroke();
  }

  roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  syncDrawOrder() {
    this.#entity?.screen?.syncDrawOrder();
  }

  destroy() {
    this.#entity?.destroy();
    for (const texture of this.#textures) {
      texture.destroy();
    }
    this.#textures.clear();
    this.#entity = null;
    this.#theme = null;
    this.#app = null;
    this.#pc = null;
  }
}
