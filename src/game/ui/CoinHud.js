import { COIN_TYPE } from "../enum/CoinType.js";
import { GamePanelHud } from "./GamePanelHud.js";

const TEXTURE_SIZE = 64;

const COINS = [
  { type: COIN_TYPE.GOLD, light: "#fff09b", main: "#f5b72e", dark: "#8a4c0a" },
  { type: COIN_TYPE.SILVER, light: "#f2f7ff", main: "#aabbd0", dark: "#48596d" },
  { type: COIN_TYPE.COPPER, light: "#ffd0a3", main: "#bd6a32", dark: "#613018" },
];

export class CoinHud extends GamePanelHud {
  #panel;
  #panelTexture;
  #coinTextures = new Map();
  #numberTextures = new Map();
  #wallet = {
    [COIN_TYPE.GOLD]: 0,
    [COIN_TYPE.SILVER]: 0,
    [COIN_TYPE.COPPER]: 0,
  };

  constructor({ pc, app, theme }) {
    super({
      pc,
      app,
      theme,
      name: "Coin wallet HUD",
      priority: 101,
    });
    this.#build();
  }

  setWallet(wallet = {}) {
    for (const { type } of COINS) {
      this.#wallet[type] = Math.max(0, Math.floor(Number(wallet[type]) || 0));
      this.#drawNumber(type);
    }
  }

  destroy() {
    this.#coinTextures.clear();
    this.#numberTextures.clear();
    this.#panel = null;
    this.#panelTexture = null;
    super.destroy();
  }

  #build() {
    const panelPaddingX = this.theme.spaceSm;
    const panelPaddingY = this.theme.spaceXs;
    const contentGap = this.theme.spaceXs;
    const indicatorGap = this.theme.spaceSm;
    const iconSize = this.counterIconSize;
    const numberWidth = this.counterNumberWidth;
    const numberHeight = this.counterNumberHeight;
    const itemWidth = iconSize + contentGap + numberWidth;
    const contentWidth =
      COINS.length * itemWidth + (COINS.length - 1) * indicatorGap;
    const panelWidth = contentWidth + panelPaddingX * 2;
    const panelHeight = iconSize + panelPaddingY * 2;

    this.#panel = this.createPanel({
      name: "Coin wallet panel",
      x: this.theme.spaceMd,
      y: this.theme.spaceXl + this.theme.spaceXs,
      width: panelWidth,
      height: panelHeight,
    });
    this.#panelTexture = this.createPanelTexture(
      "Coin wallet panel texture",
      panelWidth,
      panelHeight,
    );
    this.createImage({
      parent: this.#panel,
      name: "Coin wallet background",
      x: 0,
      y: 0,
      width: panelWidth,
      height: panelHeight,
      texture: this.#panelTexture,
    });

    COINS.forEach((coin, index) => {
      const coinTexture = this.#createCoinTexture(coin);
      this.#coinTextures.set(coin.type, coinTexture);
      const numberTexture = this.createCounterNumberTexture(
        `${coin.type} coin number texture`,
      );
      this.#numberTextures.set(coin.type, numberTexture);
      const itemX = panelPaddingX + index * (itemWidth + indicatorGap);
      this.createImage({
        parent: this.#panel,
        name: `${coin.type} coin icon`,
        x: itemX,
        y: panelPaddingY,
        width: iconSize,
        height: iconSize,
        texture: coinTexture,
      });
      this.createImage({
        parent: this.#panel,
        name: `${coin.type} coin count`,
        x: itemX + iconSize + contentGap,
        y: panelPaddingY + (iconSize - numberHeight) / 2,
        width: numberWidth,
        height: numberHeight,
        texture: numberTexture.texture,
      });
      this.#drawNumber(coin.type);
    });
    this.syncDrawOrder();
  }

  #createCoinTexture({ type, light, main, dark }) {
    return this.createDrawnTexture(
      `${type} coin texture`,
      TEXTURE_SIZE,
      TEXTURE_SIZE,
      (context) => {
        const gradient = context.createRadialGradient(24, 19, 4, 32, 32, 25);
        gradient.addColorStop(0, light);
        gradient.addColorStop(0.45, main);
        gradient.addColorStop(1, dark);
        context.beginPath();
        context.arc(32, 32, 25, 0, Math.PI * 2);
        context.fillStyle = gradient;
        context.fill();
        context.strokeStyle = dark;
        context.lineWidth = 5;
        context.stroke();
        context.beginPath();
        context.arc(32, 32, 17, 0, Math.PI * 2);
        context.strokeStyle = light;
        context.lineWidth = 2;
        context.stroke();
        context.beginPath();
        context.moveTo(32, 20);
        context.lineTo(40, 32);
        context.lineTo(32, 44);
        context.lineTo(24, 32);
        context.closePath();
        context.fillStyle = dark;
        context.globalAlpha = 0.58;
        context.fill();
      },
    );
  }

  #drawNumber(type) {
    const record = this.#numberTextures.get(type);
    if (!record) {
      return;
    }
    this.drawNumber(record, this.#wallet[type]);
  }
}
