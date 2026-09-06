const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
const SCREEN_MARGIN = 16;
const PANEL_PADDING_X = 10;
const PANEL_PADDING_Y = 6;
const CONTENT_GAP = 6;
const INDICATOR_GAP = 10;
const HEART_WIDTH = 34;
const HEART_HEIGHT = 34;
const SHIELD_WIDTH = 32;
const SHIELD_HEIGHT = 36;
const NUMBER_WIDTH = 24;
const NUMBER_HEIGHT = 32;
const TEXTURE_SIZE = 64;

const COLORS = Object.freeze({
  panelShadow: 0x061827,
  panelBorder: 0x0b4e76,
  panelHighlight: 0x52bce9,
  panel: 0x123a56,
  panelInset: 0x0a263b,
  iconActive: 0xffffff,
  iconInactive: 0x71808b,
});

export class HeroLifeHud {
  #pc;
  #app;
  #entity;
  #panelRoot = null;
  #heartEntity = null;
  #shieldEntity = null;
  #heroNumberEntity = null;
  #castleNumberEntity = null;
  #heartTexture;
  #shieldTexture;
  #heroNumberTexture;
  #castleNumberTexture;
  #panelTexture = null;
  #lives = 3;
  #maxLives = 3;
  #castleLives = 3;
  #maxCastleLives = 3;

  constructor({
    pc,
    app,
    lives = 3,
    maxLives = 3,
    castleLives = 3,
    maxCastleLives = 3,
  }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Game lives HUD");
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority: 100,
    });

    this.#heartTexture = this.#createHeartTexture();
    this.#shieldTexture = this.#createShieldTexture();
    this.#heroNumberTexture = this.#createNumberTexture("Hero life number");
    this.#castleNumberTexture = this.#createNumberTexture(
      "Castle life number",
    );
    this.#maxCastleLives = this.#normalizeMaximum(maxCastleLives);
    this.#castleLives = this.#normalizeLives(
      castleLives,
      this.#maxCastleLives,
    );
    this.setLives(lives, maxLives);
  }

  get entity() {
    return this.#entity;
  }

  get root() {
    return this.#entity;
  }

  get lives() {
    return this.#lives;
  }

  get maxLives() {
    return this.#maxLives;
  }

  attach(parent = this.#app.root) {
    if (!this.#entity || this.#entity.parent === parent) return;
    parent.addChild(this.#entity);
  }

  setLives(current, maximum = this.#maxLives) {
    const nextMaximum = this.#normalizeMaximum(maximum);
    const nextLives = this.#normalizeLives(current, nextMaximum);
    const shouldRebuild = nextMaximum !== this.#maxLives || !this.#panelRoot;
    this.#maxLives = nextMaximum;
    this.#lives = nextLives;
    if (shouldRebuild) this.#build();
    this.#syncIndicator(
      this.#heartEntity,
      this.#heroNumberEntity,
      this.#heroNumberTexture,
      nextLives,
    );
  }

  setCastleLives(current, maximum = this.#maxCastleLives) {
    const nextMaximum = this.#normalizeMaximum(maximum);
    const nextLives = this.#normalizeLives(current, nextMaximum);
    const shouldRebuild = nextMaximum !== this.#maxCastleLives;
    this.#maxCastleLives = nextMaximum;
    this.#castleLives = nextLives;
    if (shouldRebuild) this.#build();
    this.#syncIndicator(
      this.#shieldEntity,
      this.#castleNumberEntity,
      this.#castleNumberTexture,
      nextLives,
    );
  }

  setVisible(visible) {
    if (this.#entity) this.#entity.enabled = Boolean(visible);
  }

  destroy() {
    this.#entity?.destroy();
    this.#heartTexture?.destroy();
    this.#shieldTexture?.destroy();
    this.#heroNumberTexture?.texture.destroy();
    this.#castleNumberTexture?.texture.destroy();
    this.#panelTexture?.destroy();
    this.#entity = null;
    this.#panelRoot = null;
    this.#heartEntity = null;
    this.#shieldEntity = null;
    this.#heroNumberEntity = null;
    this.#castleNumberEntity = null;
    this.#heartTexture = null;
    this.#shieldTexture = null;
    this.#heroNumberTexture = null;
    this.#castleNumberTexture = null;
    this.#panelTexture = null;
    this.#app = null;
    this.#pc = null;
  }

  #build() {
    this.#panelRoot?.destroy();
    this.#panelTexture?.destroy();
    const heroNumberWidth = this.#numberWidth(this.#maxLives);
    const castleNumberWidth = this.#numberWidth(this.#maxCastleLives);
    const contentWidth =
      HEART_WIDTH +
      CONTENT_GAP +
      heroNumberWidth +
      INDICATOR_GAP +
      SHIELD_WIDTH +
      CONTENT_GAP +
      castleNumberWidth;
    const contentHeight = Math.max(
      HEART_HEIGHT,
      SHIELD_HEIGHT,
      NUMBER_HEIGHT,
    );
    const panelWidth = contentWidth + PANEL_PADDING_X * 2;
    const panelHeight = contentHeight + PANEL_PADDING_Y * 2;

    this.#panelRoot = new this.#pc.Entity("Game lives panel");
    this.#panelRoot.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_GROUP,
      anchor: new this.#pc.Vec4(0, 1, 0, 1),
      pivot: new this.#pc.Vec2(0, 1),
      width: panelWidth,
      height: panelHeight,
      useInput: false,
    });
    this.#panelRoot.setLocalPosition(SCREEN_MARGIN, -SCREEN_MARGIN, 0);
    this.#entity.addChild(this.#panelRoot);
    this.#panelTexture = this.#createPanelTexture(panelWidth, panelHeight);
    this.#createImage({
      name: "Lives panel background",
      x: 0,
      y: 0,
      width: panelWidth,
      height: panelHeight,
      texture: this.#panelTexture,
    });

    const centeredY = (height) =>
      PANEL_PADDING_Y + (contentHeight - height) / 2;
    this.#heartEntity = this.#createImage({
      name: "Hero life icon",
      x: PANEL_PADDING_X,
      y: centeredY(HEART_HEIGHT),
      width: HEART_WIDTH,
      height: HEART_HEIGHT,
      texture: this.#heartTexture,
    });
    const heroNumberX = PANEL_PADDING_X + HEART_WIDTH + CONTENT_GAP;
    this.#heroNumberEntity = this.#createImage({
      name: "Hero life count",
      x: heroNumberX,
      y: centeredY(NUMBER_HEIGHT),
      width: heroNumberWidth,
      height: NUMBER_HEIGHT,
      texture: this.#heroNumberTexture.texture,
    });
    const shieldX = heroNumberX + heroNumberWidth + INDICATOR_GAP;
    this.#shieldEntity = this.#createImage({
      name: "Castle life icon",
      x: shieldX,
      y: centeredY(SHIELD_HEIGHT),
      width: SHIELD_WIDTH,
      height: SHIELD_HEIGHT,
      texture: this.#shieldTexture,
    });
    this.#castleNumberEntity = this.#createImage({
      name: "Castle life count",
      x: shieldX + SHIELD_WIDTH + CONTENT_GAP,
      y: centeredY(NUMBER_HEIGHT),
      width: castleNumberWidth,
      height: NUMBER_HEIGHT,
      texture: this.#castleNumberTexture.texture,
    });

    this.#syncIndicator(
      this.#heartEntity,
      this.#heroNumberEntity,
      this.#heroNumberTexture,
      this.#lives,
    );
    this.#syncIndicator(
      this.#shieldEntity,
      this.#castleNumberEntity,
      this.#castleNumberTexture,
      this.#castleLives,
    );
    this.#entity.screen.syncDrawOrder();
  }

  #createImage({ name, x, y, width, height, texture }) {
    const entity = new this.#pc.Entity(name);
    entity.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_IMAGE,
      anchor: new this.#pc.Vec4(0, 1, 0, 1),
      pivot: new this.#pc.Vec2(0, 1),
      width,
      height,
      color: this.#color(COLORS.iconActive),
      useInput: false,
    });
    entity.element.texture = texture;
    entity.setLocalPosition(x, -y, 0);
    this.#panelRoot.addChild(entity);
    return entity;
  }

  #syncIndicator(icon, number, numberTexture, value) {
    if (!icon || !number || !numberTexture) return;
    icon.element.color = this.#color(
      value > 0 ? COLORS.iconActive : COLORS.iconInactive,
    );
    this.#drawNumber(numberTexture, value);
    number.element.texture = numberTexture.texture;
  }

  #createHeartTexture() {
    return this.#createTexture("Hero heart icon", (context) => {
      const gradient = context.createLinearGradient(0, 10, 0, 58);
      gradient.addColorStop(0, "#ff5866");
      gradient.addColorStop(0.48, "#ec273b");
      gradient.addColorStop(1, "#a90825");
      this.#heartPath(context);
      context.fillStyle = gradient;
      context.fill();
      context.lineJoin = "round";
      context.strokeStyle = "#651022";
      context.lineWidth = 6;
      context.stroke();

      context.beginPath();
      context.moveTo(18, 20);
      context.bezierCurveTo(20, 13, 27, 11, 31, 16);
      context.strokeStyle = "rgba(255, 226, 226, 0.8)";
      context.lineCap = "round";
      context.lineWidth = 4;
      context.stroke();
    });
  }

  #createPanelTexture(width, height) {
    const scale = 4;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#174e70");
    gradient.addColorStop(1, "#0b2d49");
    this.#roundedRect(context, 1.5, 1.5, width - 3, height - 3, 9);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = "#061d31";
    context.lineWidth = 3;
    context.stroke();
    this.#roundedRect(context, 3.5, 3.5, width - 7, height - 7, 7);
    context.strokeStyle = "rgba(51, 145, 190, 0.72)";
    context.lineWidth = 1;
    context.stroke();
    return this.#createPlayCanvasTexture("Lives panel texture", canvas);
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

  #heartPath(context) {
    context.beginPath();
    context.moveTo(32, 57);
    context.bezierCurveTo(26, 50, 8, 39, 8, 23);
    context.bezierCurveTo(8, 10, 24, 5, 32, 16);
    context.bezierCurveTo(40, 5, 56, 10, 56, 23);
    context.bezierCurveTo(56, 39, 38, 50, 32, 57);
    context.closePath();
  }

  #createShieldTexture() {
    return this.#createTexture("Castle shield icon", (context) => {
      const gradient = context.createLinearGradient(0, 7, 0, 58);
      gradient.addColorStop(0, "#35c7ff");
      gradient.addColorStop(0.5, "#078dde");
      gradient.addColorStop(1, "#0750a8");
      this.#shieldPath(context);
      context.fillStyle = gradient;
      context.fill();
      context.lineJoin = "round";
      context.strokeStyle = "#06355d";
      context.lineWidth = 9;
      context.stroke();
      this.#shieldPath(context);
      context.strokeStyle = "#9deaff";
      context.lineWidth = 4;
      context.stroke();

      context.beginPath();
      context.moveTo(23, 17);
      context.lineTo(23, 38);
      context.bezierCurveTo(23, 44, 27, 48, 31, 51);
      context.strokeStyle = "rgba(224, 250, 255, 0.66)";
      context.lineCap = "round";
      context.lineWidth = 3;
      context.stroke();
    });
  }

  #shieldPath(context) {
    context.beginPath();
    context.moveTo(32, 7);
    context.lineTo(53, 14);
    context.lineTo(50, 38);
    context.bezierCurveTo(48, 48, 40, 55, 32, 59);
    context.bezierCurveTo(24, 55, 16, 48, 14, 38);
    context.lineTo(11, 14);
    context.closePath();
  }

  #createNumberTexture(name) {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const texture = this.#createPlayCanvasTexture(name, canvas);
    return { canvas, context: canvas.getContext("2d"), texture };
  }

  #drawNumber(record, value) {
    const { canvas, context, texture } = record;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "900 48px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = "#071522";
    context.lineWidth = 7;
    context.strokeText(String(Math.max(0, value)), 32, 34);
    context.fillStyle = "#ffffff";
    context.fillText(String(Math.max(0, value)), 32, 34);
    texture.setSource(canvas);
  }

  #createTexture(name, draw) {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    draw(canvas.getContext("2d"));
    return this.#createPlayCanvasTexture(name, canvas);
  }

  #createPlayCanvasTexture(name, canvas) {
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
    texture.name = name;
    texture.setSource(canvas);
    return texture;
  }

  #numberWidth(maximum) {
    return NUMBER_WIDTH * Math.max(1, String(maximum).length);
  }

  #normalizeMaximum(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  #normalizeLives(value, maximum) {
    return Math.min(maximum, Math.max(0, Math.floor(Number(value) || 0)));
  }

  #color(value) {
    return new this.#pc.Color(
      ((value >> 16) & 0xff) / 255,
      ((value >> 8) & 0xff) / 255,
      (value & 0xff) / 255,
    );
  }
}
