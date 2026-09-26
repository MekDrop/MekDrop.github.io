import { GamePanelHud } from "./GamePanelHud.js";

const TEXTURE_SIZE = 64;
const DEATH_ANIMATION_DURATION = 0.82;
const DEATH_FADE_START = 0.55;

const DEFAULT_COLORS = Object.freeze({
  iconActive: 0xffffff,
  iconInactive: 0x71808b,
});

export class HeroLifeHud extends GamePanelHud {
  #panelRoot = null;
  #heartEntity = null;
  #heartLeftFragmentEntity = null;
  #heartRightFragmentEntity = null;
  #shieldEntity = null;
  #heroNumberEntity = null;
  #castleNumberEntity = null;
  #heartTexture;
  #heartLeftFragmentTexture;
  #heartRightFragmentTexture;
  #shieldTexture;
  #heroNumberTexture;
  #castleNumberTexture;
  #panelTexture = null;
  #lives = 3;
  #maxLives = 3;
  #castleLives = 3;
  #maxCastleLives = 3;
  #hasDisplayedLives = false;
  #deathAnimationElapsed = null;
  #heartX = 0;
  #heartY = 0;
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
    this.#heartLeftFragmentTexture = this.#createHeartFragmentTexture("left");
    this.#heartRightFragmentTexture =
      this.#createHeartFragmentTexture("right");
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
    const previousLives = this.#lives;
    const shouldAnimate =
      this.#hasDisplayedLives && nextLives < previousLives;
    const shouldRebuild = nextMaximum !== this.#maxLives || !this.#panelRoot;
    this.#maxLives = nextMaximum;
    this.#lives = nextLives;
    if (shouldRebuild) {
      this.#build();
    }
    this.#syncIndicator(
      this.#heartEntity,
      this.#heroNumberEntity,
      this.#heroNumberTexture,
      nextLives,
    );
    this.#hasDisplayedLives = true;
    if (shouldAnimate) {
      this.#startDeathAnimation();
    } else if (nextLives !== previousLives) {
      this.#finishDeathAnimation();
    }
  }

  update(deltaTime) {
    if (this.#deathAnimationElapsed === null) {
      return;
    }

    const numericDelta = Number(deltaTime);
    const safeDelta =
      Number.isFinite(numericDelta) && numericDelta > 0 ? numericDelta : 0;
    this.#deathAnimationElapsed = Math.min(
      DEATH_ANIMATION_DURATION,
      this.#deathAnimationElapsed + safeDelta,
    );
    if (this.#deathAnimationElapsed >= DEATH_ANIMATION_DURATION) {
      this.#finishDeathAnimation();
      return;
    }

    const progress = this.#deathAnimationElapsed / DEATH_ANIMATION_DURATION;
    const time = this.#deathAnimationElapsed;
    const separationKick = 4 * (1 - Math.exp(-time * 24));
    const horizontalOffset = separationKick + 23 * time;
    const verticalOffset = -5 * (1 - Math.exp(-time * 20)) + 72 * time ** 2;
    const rotation = 10 + 130 * progress;
    const fadeProgress = Math.max(
      0,
      (progress - DEATH_FADE_START) / (1 - DEATH_FADE_START),
    );
    const opacity = 1 - fadeProgress ** 2 * (3 - 2 * fadeProgress);

    this.#positionHeartFragment(
      this.#heartLeftFragmentEntity,
      -horizontalOffset,
      verticalOffset,
      -rotation,
      opacity,
    );
    this.#positionHeartFragment(
      this.#heartRightFragmentEntity,
      horizontalOffset,
      verticalOffset,
      rotation,
      opacity,
    );
  }

  setCastleLives(current, maximum = this.#maxCastleLives) {
    const nextMaximum = this.#normalizeMaximum(maximum);
    const nextLives = this.#normalizeLives(current, nextMaximum);
    const shouldRebuild = nextMaximum !== this.#maxCastleLives;
    this.#maxCastleLives = nextMaximum;
    this.#castleLives = nextLives;
    if (shouldRebuild) {
      this.#build();
    }
    this.#syncIndicator(
      this.#shieldEntity,
      this.#castleNumberEntity,
      this.#castleNumberTexture,
      nextLives,
    );
  }

  destroy() {
    this.#finishDeathAnimation();
    this.#panelRoot = null;
    this.#heartEntity = null;
    this.#heartLeftFragmentEntity = null;
    this.#heartRightFragmentEntity = null;
    this.#shieldEntity = null;
    this.#heroNumberEntity = null;
    this.#castleNumberEntity = null;
    this.#heartTexture = null;
    this.#heartLeftFragmentTexture = null;
    this.#heartRightFragmentTexture = null;
    this.#shieldTexture = null;
    this.#heroNumberTexture = null;
    this.#castleNumberTexture = null;
    this.#panelTexture = null;
    super.destroy();
  }

  #build() {
    this.#finishDeathAnimation();
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
    this.#heartX = panelPaddingX;
    this.#heartY = centeredY(iconSize);
    this.#heartLeftFragmentEntity = this.#createHeartFragmentEntity(
      "Hero life icon left fragment",
      this.#heartLeftFragmentTexture,
    );
    this.#heartRightFragmentEntity = this.#createHeartFragmentEntity(
      "Hero life icon right fragment",
      this.#heartRightFragmentTexture,
    );
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
        this.#drawHeart(context);
      },
    );
  }

  #createHeartFragmentTexture(side) {
    return this.createDrawnTexture(
      `Hero heart ${side} fragment`,
      TEXTURE_SIZE,
      TEXTURE_SIZE,
      (context) => {
        context.save();
        this.#heartFragmentPath(context, side);
        context.clip();
        this.#drawHeart(context);
        context.restore();
      },
    );
  }

  #drawHeart(context) {
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
  }

  #heartFragmentPath(context, side) {
    const crack = [
      [33, -2],
      [32, 14],
      [27, 22],
      [35, 29],
      [29, 37],
      [34, 45],
      [31, 66],
    ];
    context.beginPath();
    if (side === "left") {
      context.moveTo(-2, -2);
      context.lineTo(crack[0][0], crack[0][1]);
      for (const [x, y] of crack.slice(1)) {
        context.lineTo(x, y);
      }
      context.lineTo(-2, 66);
    } else {
      context.moveTo(crack[0][0], crack[0][1]);
      context.lineTo(66, -2);
      context.lineTo(66, 66);
      context.lineTo(crack.at(-1)[0], crack.at(-1)[1]);
      for (const [x, y] of crack.slice(0, -1).reverse()) {
        context.lineTo(x, y);
      }
    }
    context.closePath();
  }

  #createHeartFragmentEntity(name, texture) {
    const iconSize = this.counterIconSize;
    const entity = this.createImage({
      parent: this.#panelRoot,
      name,
      x: this.#heartX,
      y: this.#heartY,
      width: iconSize,
      height: iconSize,
      texture,
    });
    entity.element.pivot = new this.pc.Vec2(0.5, 0.5);
    entity.enabled = false;
    return entity;
  }

  #startDeathAnimation() {
    if (
      !this.#heartEntity ||
      !this.#heartLeftFragmentEntity ||
      !this.#heartRightFragmentEntity
    ) {
      return;
    }
    if (
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      this.#finishDeathAnimation();
      return;
    }

    const activeColor = this.theme.playCanvasColor(
      this.pc,
      this.#colors.iconActive,
    );
    this.#deathAnimationElapsed = 0;
    this.#heartEntity.enabled = false;
    for (const fragment of [
      this.#heartLeftFragmentEntity,
      this.#heartRightFragmentEntity,
    ]) {
      fragment.enabled = true;
      fragment.element.color = activeColor;
      fragment.element.opacity = 1;
    }
    this.#positionHeartFragment(
      this.#heartLeftFragmentEntity,
      0,
      0,
      0,
      1,
    );
    this.#positionHeartFragment(
      this.#heartRightFragmentEntity,
      0,
      0,
      0,
      1,
    );
  }

  #positionHeartFragment(entity, offsetX, offsetY, rotation, opacity) {
    if (!entity) {
      return;
    }
    const halfSize = this.counterIconSize / 2;
    entity.setLocalPosition(
      this.#heartX + halfSize + offsetX,
      -(this.#heartY + halfSize + offsetY),
      0,
    );
    entity.setLocalEulerAngles(0, 0, rotation);
    entity.element.opacity = opacity;
  }

  #finishDeathAnimation() {
    this.#deathAnimationElapsed = null;
    if (this.#heartEntity) {
      this.#heartEntity.enabled = true;
    }
    for (const fragment of [
      this.#heartLeftFragmentEntity,
      this.#heartRightFragmentEntity,
    ]) {
      if (fragment) {
        fragment.enabled = false;
        fragment.element.opacity = 1;
      }
    }
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
