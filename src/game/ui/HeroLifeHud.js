import { GamePanelHud } from "./GamePanelHud.js";

const SCREEN_MARGIN = 16;
const PANEL_PADDING_X = 6;
const PANEL_PADDING_Y = 4;
const CONTENT_GAP = 4;
const INDICATOR_GAP = 6;
const HEART_WIDTH = 22;
const HEART_HEIGHT = 22;
const SHIELD_WIDTH = 20;
const SHIELD_HEIGHT = 23;
const NUMBER_WIDTH = 15;
const NUMBER_HEIGHT = 20;
const TEXTURE_SIZE = 64;

const DEFAULT_COLORS = Object.freeze({
  iconActive: 0xffffff,
  iconInactive: 0x71808b,
});

export class HeroLifeHud extends GamePanelHud {
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
  #colors;

  constructor({
    pc,
    app,
    lives = 3,
    maxLives = 3,
    castleLives = 3,
    maxCastleLives = 3,
    colors = DEFAULT_COLORS,
    theme,
  }) {
    super({ pc, app, theme, name: "Game lives HUD", priority: 100 });
    this.#colors = colors;

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

  get lives() {
    return this.#lives;
  }

  get maxLives() {
    return this.#maxLives;
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

  destroy() {
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
    super.destroy();
  }

  #build() {
    this.#panelRoot?.destroy();
    this.releaseTexture(this.#panelTexture);
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

    this.#panelRoot = this.createPanel({
      name: "Game lives panel",
      x: SCREEN_MARGIN,
      y: SCREEN_MARGIN,
      width: panelWidth,
      height: panelHeight,
    });
    this.#panelTexture = this.createPanelTexture(
      "Lives panel texture",
      panelWidth,
      panelHeight,
    );
    this.createImage({
      parent: this.#panelRoot,
      name: "Lives panel background",
      x: 0,
      y: 0,
      width: panelWidth,
      height: panelHeight,
      texture: this.#panelTexture,
    });

    const centeredY = (height) =>
      PANEL_PADDING_Y + (contentHeight - height) / 2;
    this.#heartEntity = this.createImage({
      parent: this.#panelRoot,
      name: "Hero life icon",
      x: PANEL_PADDING_X,
      y: centeredY(HEART_HEIGHT),
      width: HEART_WIDTH,
      height: HEART_HEIGHT,
      texture: this.#heartTexture,
    });
    const heroNumberX = PANEL_PADDING_X + HEART_WIDTH + CONTENT_GAP;
    this.#heroNumberEntity = this.createImage({
      parent: this.#panelRoot,
      name: "Hero life count",
      x: heroNumberX,
      y: centeredY(NUMBER_HEIGHT),
      width: heroNumberWidth,
      height: NUMBER_HEIGHT,
      texture: this.#heroNumberTexture.texture,
    });
    const shieldX = heroNumberX + heroNumberWidth + INDICATOR_GAP;
    this.#shieldEntity = this.createImage({
      parent: this.#panelRoot,
      name: "Castle life icon",
      x: shieldX,
      y: centeredY(SHIELD_HEIGHT),
      width: SHIELD_WIDTH,
      height: SHIELD_HEIGHT,
      texture: this.#shieldTexture,
    });
    this.#castleNumberEntity = this.createImage({
      parent: this.#panelRoot,
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
    this.syncDrawOrder();
  }

  #syncIndicator(icon, number, numberTexture, value) {
    if (!icon || !number || !numberTexture) {
      return;
    }
    icon.element.color = this.theme.playCanvasColor(
      this.pc,
      value > 0 ? this.#colors.iconActive : this.#colors.iconInactive,
    );
    this.#drawNumber(numberTexture, value);
    number.element.texture = numberTexture.texture;
  }

  #createHeartTexture() {
    return this.createDrawnTexture(
      "Hero heart icon",
      TEXTURE_SIZE,
      TEXTURE_SIZE,
      (context) => {
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
      },
    );
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
    return this.createDrawnTexture(
      "Castle shield icon",
      TEXTURE_SIZE,
      TEXTURE_SIZE,
      (context) => {
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
      },
    );
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
    return this.createTextureRecord(name, TEXTURE_SIZE, TEXTURE_SIZE);
  }

  #drawNumber(record, value) {
    const { canvas, context, texture } = record;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "900 48px Arial, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = this.theme.shadow;
    context.lineWidth = 7;
    context.strokeText(String(Math.max(0, value)), 32, 34);
    context.fillStyle = this.theme.text;
    context.fillText(String(Math.max(0, value)), 32, 34);
    texture.setSource(canvas);
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
}
