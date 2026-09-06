const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 122;
const PANEL_BOTTOM_MARGIN = 36;

export class GameOverHud {
  #pc;
  #app;
  #entity;
  #panelTexture;

  constructor({ pc, app, title, prompt }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Game over HUD");
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority: 110,
    });
    this.#createDimmer();
    this.#panelTexture = this.#createPanelTexture(title, prompt);
    this.#createPanel();
    this.#entity.enabled = false;
  }

  attach(parent = this.#app.root) {
    if (!this.#entity || this.#entity.parent === parent) return;
    parent.addChild(this.#entity);
  }

  setVisible(visible) {
    if (this.#entity) this.#entity.enabled = Boolean(visible);
  }

  destroy() {
    this.#entity?.destroy();
    this.#panelTexture?.destroy();
    this.#entity = null;
    this.#panelTexture = null;
    this.#app = null;
    this.#pc = null;
  }

  #createDimmer() {
    const dimmer = new this.#pc.Entity("Game over dimmer");
    dimmer.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0, 0, 1, 1),
      pivot: new this.#pc.Vec2(0.5, 0.5),
      margin: new this.#pc.Vec4(0, 0, 0, 0),
      color: new this.#pc.Color(0.025, 0.035, 0.045),
      opacity: 0.62,
      useInput: false,
    });
    this.#entity.addChild(dimmer);
  }

  #createPanel() {
    const panel = new this.#pc.Entity("Game over panel");
    panel.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0.5, 0, 0.5, 0),
      pivot: new this.#pc.Vec2(0.5, 0),
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      color: new this.#pc.Color(1, 1, 1),
      useInput: false,
    });
    panel.element.texture = this.#panelTexture;
    panel.setLocalPosition(0, PANEL_BOTTOM_MARGIN, 0);
    this.#entity.addChild(panel);
    this.#entity.screen.syncDrawOrder();
  }

  #createPanelTexture(title, prompt) {
    const canvas = document.createElement("canvas");
    canvas.width = 680;
    canvas.height = 244;
    const context = canvas.getContext("2d");
    const x = 18;
    const y = 18;
    const width = canvas.width - 36;
    const height = canvas.height - 36;

    context.shadowColor = "rgba(0, 0, 0, 0.52)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 10;
    this.#roundedRect(context, x, y, width, height, 28);
    context.fillStyle = "rgba(24, 8, 18, 0.96)";
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = "#ff6477";
    context.lineWidth = 3;
    context.stroke();

    const titleGradient = context.createLinearGradient(0, 52, 0, 140);
    titleGradient.addColorStop(0, "#ff91a0");
    titleGradient.addColorStop(1, "#ff405b");
    context.font = "900 64px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = "#590a18";
    context.lineWidth = 10;
    context.strokeText(String(title).toUpperCase(), canvas.width / 2, 94);
    context.fillStyle = titleGradient;
    context.fillText(String(title).toUpperCase(), canvas.width / 2, 94);

    context.font = "800 22px Arial, sans-serif";
    context.strokeStyle = "#160910";
    context.lineWidth = 6;
    context.strokeText(String(prompt).toUpperCase(), canvas.width / 2, 169);
    context.fillStyle = "#f9e9ed";
    context.fillText(String(prompt).toUpperCase(), canvas.width / 2, 169);

    const texture = new this.#pc.Texture(this.#app.graphicsDevice, {
      width: canvas.width,
      height: canvas.height,
      format: this.#pc.PIXELFORMAT_RGBA8,
      mipmaps: true,
      minFilter: this.#pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: this.#pc.FILTER_LINEAR,
      addressU: this.#pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.#pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.name = "Game over panel texture";
    texture.setSource(canvas);
    return texture;
  }

  #roundedRect(context, x, y, width, height, radius) {
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
}
