import { GamePanelHud } from "./GamePanelHud.js";

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
    this.#heroNumberTexture = this.createCounterNumberTexture(
      "Hero life number",
    );
    this.#castleNumberTexture = this.createCounterNumberTexture(
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
    const panelPaddingX = this.theme.spaceSm;
    const panelPaddingY = this.theme.spaceXs;
    const contentGap = this.theme.spaceXs;
    const indicatorGap = this.theme.spaceSm;
    const iconSize = this.counterIconSize;
    const numberHeight = this.counterNumberHeight;
    const heroNumberWidth = this.#numberWidth(this.#maxLives);
    const castleNumberWidth = this.#numberWidth(this.#maxCastleLives);
    const contentWidth =
      iconSize +
      contentGap +
      heroNumberWidth +
      indicatorGap +
      iconSize +
      contentGap +
      castleNumberWidth;
    const contentHeight = Math.max(iconSize, numberHeight);
    const panelWidth = contentWidth + panelPaddingX * 2;
    const panelHeight = contentHeight + panelPaddingY * 2;

    this.#panelRoot = this.createPanel({
      name: "Game lives panel",
      x: this.theme.spaceMd,
      y: this.theme.spaceMd,
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
      panelPaddingY + (contentHeight - height) / 2;
    this.#heartEntity = this.createImage({
      parent: this.#panelRoot,
      name: "Hero life icon",
      x: panelPaddingX,
      y: centeredY(iconSize),
      width: iconSize,
      height: iconSize,
      texture: this.#heartTexture,
    });
    const heroNumberX = panelPaddingX + iconSize + contentGap;
    this.#heroNumberEntity = this.createImage({
      parent: this.#panelRoot,
      name: "Hero life count",
      x: heroNumberX,
      y: centeredY(numberHeight),
      width: heroNumberWidth,
      height: numberHeight,
      texture: this.#heroNumberTexture.texture,
    });
    const shieldX = heroNumberX + heroNumberWidth + indicatorGap;
    this.#shieldEntity = this.createImage({
      parent: this.#panelRoot,
      name: "Castle life icon",
      x: shieldX,
      y: centeredY(iconSize),
      width: iconSize,
      height: iconSize,
      texture: this.#shieldTexture,
    });
    this.#castleNumberEntity = this.createImage({
      parent: this.#panelRoot,
      name: "Castle life count",
      x: shieldX + iconSize + contentGap,
      y: centeredY(numberHeight),
      width: castleNumberWidth,
      height: numberHeight,
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
    this.drawNumber(numberTexture, value);
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

  #numberWidth(maximum) {
    return this.counterNumberWidth * Math.max(1, String(maximum).length);
  }

  #normalizeMaximum(value) {
    return Math.max(0, Math.floor(Number(value) || 0));
  }

  #normalizeLives(value, maximum) {
    return Math.min(maximum, Math.max(0, Math.floor(Number(value) || 0)));
  }
}
