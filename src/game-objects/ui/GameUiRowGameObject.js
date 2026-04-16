import { Container, Graphics, Text } from "pixi.js";
import { GameObject } from "src/game-objects/core/GameObject";

const LABEL_PADDING_X = 12;
const LABEL_PADDING_Y = 8;

/** @extends {GameObject<Container>} */
export class GameUiRowGameObject extends GameObject {
  constructor(props = {}) {
    super({
      text: "",
      style: {},
      panelAlpha: 0.78,
      background: null,
      label: null,
      ...props,
    });
  }

  _prepareSprite() {
    const sprite = new Container();
    this.background = new Graphics();
    this.label = new Text({
      text: this.text,
      style: this.style,
    });
    this.label.x = LABEL_PADDING_X;
    this.label.y = LABEL_PADDING_Y;
    sprite.addChild(this.background, this.label);
    return sprite;
  }

  resize(width, minHeight) {
    if (!this.label || !this.background) return;
    const labelWidth = Math.max(1, width - LABEL_PADDING_X * 2);
    this.label.style.wordWrapWidth = labelWidth;
    this.#drawPanelBackground(
      this.background,
      width,
      Math.max(minHeight, this.label.height + LABEL_PADDING_Y * 2),
      this.panelAlpha,
    );
  }

  #drawPanelBackground(graphics, width, height, alpha = 0.78) {
    graphics
      .clear()
      .roundRect(0, 0, width, height, 10)
      .fill({ color: 0x06120b, alpha })
      .stroke({ width: 1, color: 0x96ffe0, alpha: 0.34 });
  }
}
