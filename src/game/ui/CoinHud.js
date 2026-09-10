import { COIN_TYPE } from "../enum/CoinType.js";
import { GamePanelHud } from "./GamePanelHud.js";

const SCREEN_MARGIN = 16;
const PANEL_TOP = 52;
const PANEL_WIDTH = 190;
const PANEL_HEIGHT = 34;
const ITEM_WIDTH = 60;
const COIN_SIZE = 22;
const NUMBER_WIDTH = 34;
const NUMBER_HEIGHT = 20;
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
    this.#panel = this.createPanel({
      name: "Coin wallet panel",
      x: SCREEN_MARGIN,
      y: PANEL_TOP,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
    });
    this.#panelTexture = this.createPanelTexture(
      "Coin wallet panel texture",
      PANEL_WIDTH,
      PANEL_HEIGHT,
    );
    this.createImage({
      parent: this.#panel,
      name: "Coin wallet background",
      x: 0,
      y: 0,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      texture: this.#panelTexture,
    });

    COINS.forEach((coin, index) => {
      const coinTexture = this.#createCoinTexture(coin);
      this.#coinTextures.set(coin.type, coinTexture);
      const numberTexture = this.#createNumberTexture(coin.type);
      this.#numberTextures.set(coin.type, numberTexture);
      const itemX = 6 + index * ITEM_WIDTH;
      this.createImage({
        parent: this.#panel,
        name: `${coin.type} coin icon`,
        x: itemX,
        y: 6,
        width: COIN_SIZE,
        height: COIN_SIZE,
        texture: coinTexture,
      });
      this.createImage({
        parent: this.#panel,
        name: `${coin.type} coin count`,
        x: itemX + COIN_SIZE,
        y: 7,
        width: NUMBER_WIDTH,
        height: NUMBER_HEIGHT,
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

  #createNumberTexture(type) {
    return this.createTextureRecord(
      `${type} coin number texture`,
      TEXTURE_SIZE * 2,
      TEXTURE_SIZE,
    );
  }

  #drawNumber(type) {
    const record = this.#numberTextures.get(type);
    if (!record) {
      return;
    }
    const { canvas, context, texture } = record;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = "900 42px Arial, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = this.theme.shadow;
    context.lineWidth = 7;
    const value = String(this.#wallet[type]);
    context.strokeText(value, 4, 34);
    context.fillStyle = this.theme.text;
    context.fillText(value, 4, 34);
    texture.setSource(canvas);
  }
}
