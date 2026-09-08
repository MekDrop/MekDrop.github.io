import { COIN_TYPE } from "../enum/CoinType.js";

const REFERENCE_WIDTH = 1280;
const REFERENCE_HEIGHT = 720;
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

export class CoinHud {
  #pc;
  #app;
  #entity;
  #panel;
  #panelTexture;
  #coinTextures = new Map();
  #numberTextures = new Map();
  #wallet = {
    [COIN_TYPE.GOLD]: 0,
    [COIN_TYPE.SILVER]: 0,
    [COIN_TYPE.COPPER]: 0,
  };

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
    this.#entity = new pc.Entity("Coin wallet HUD");
    this.#entity.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(REFERENCE_WIDTH, REFERENCE_HEIGHT),
      scaleMode: pc.SCALEMODE_BLEND,
      scaleBlend: 0.5,
      priority: 101,
    });
    this.#build();
  }

  attach(parent = this.#app.root) {
    if (this.#entity && this.#entity.parent !== parent) {
      parent.addChild(this.#entity);
    }
  }

  setWallet(wallet = {}) {
    for (const { type } of COINS) {
      this.#wallet[type] = Math.max(0, Math.floor(Number(wallet[type]) || 0));
      this.#drawNumber(type);
    }
  }

  set visible(visible) {
    if (this.#entity) {
      this.#entity.enabled = Boolean(visible);
    }
  }

  destroy() {
    this.#entity?.destroy();
    this.#panelTexture?.destroy();
    for (const texture of this.#coinTextures.values()) {
      texture.destroy();
    }
    for (const record of this.#numberTextures.values()) {
      record.texture.destroy();
    }
    this.#coinTextures.clear();
    this.#numberTextures.clear();
    this.#entity = null;
    this.#panel = null;
    this.#panelTexture = null;
    this.#app = null;
    this.#pc = null;
  }

  #build() {
    this.#panel = new this.#pc.Entity("Coin wallet panel");
    this.#panel.addComponent("element", {
      type: this.#pc.ELEMENTTYPE_GROUP,
      anchor: new this.#pc.Vec4(0, 1, 0, 1),
      pivot: new this.#pc.Vec2(0, 1),
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      useInput: false,
    });
    this.#panel.setLocalPosition(SCREEN_MARGIN, -PANEL_TOP, 0);
    this.#entity.addChild(this.#panel);
    this.#panelTexture = this.#createPanelTexture();
    this.#createImage({
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
      this.#createImage({
        name: `${coin.type} coin icon`,
        x: itemX,
        y: 6,
        width: COIN_SIZE,
        height: COIN_SIZE,
        texture: coinTexture,
      });
      this.#createImage({
        name: `${coin.type} coin count`,
        x: itemX + COIN_SIZE,
        y: 7,
        width: NUMBER_WIDTH,
        height: NUMBER_HEIGHT,
        texture: numberTexture.texture,
      });
      this.#drawNumber(coin.type);
    });
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
      useInput: false,
    });
    entity.element.texture = texture;
    entity.setLocalPosition(x, -y, 0);
    this.#panel.addChild(entity);
    return entity;
  }

  #createPanelTexture() {
    const scale = 4;
    const canvas = document.createElement("canvas");
    canvas.width = PANEL_WIDTH * scale;
    canvas.height = PANEL_HEIGHT * scale;
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    const gradient = context.createLinearGradient(0, 0, 0, PANEL_HEIGHT);
    gradient.addColorStop(0, "#174e70");
    gradient.addColorStop(1, "#0b2d49");
    this.#roundedRect(context, 1.5, 1.5, PANEL_WIDTH - 3, PANEL_HEIGHT - 3, 9);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = "#061d31";
    context.lineWidth = 3;
    context.stroke();
    this.#roundedRect(context, 3.5, 3.5, PANEL_WIDTH - 7, PANEL_HEIGHT - 7, 7);
    context.strokeStyle = "rgba(51, 145, 190, 0.72)";
    context.lineWidth = 1;
    context.stroke();
    return this.#createTexture("Coin wallet panel texture", canvas);
  }

  #createCoinTexture({ type, light, main, dark }) {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_SIZE;
    canvas.height = TEXTURE_SIZE;
    const context = canvas.getContext("2d");
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
    return this.#createTexture(`${type} coin texture`, canvas);
  }

  #createNumberTexture(type) {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_SIZE * 2;
    canvas.height = TEXTURE_SIZE;
    return {
      canvas,
      context: canvas.getContext("2d"),
      texture: this.#createTexture(`${type} coin number texture`, canvas),
    };
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
    context.strokeStyle = "#071522";
    context.lineWidth = 7;
    const value = String(this.#wallet[type]);
    context.strokeText(value, 4, 34);
    context.fillStyle = "#ffffff";
    context.fillText(value, 4, 34);
    texture.setSource(canvas);
  }

  #createTexture(name, canvas) {
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

  #roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }
}
