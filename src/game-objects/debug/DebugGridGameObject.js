import { GameObject } from "src/game-objects/core/GameObject";
import { Container, Graphics, Text } from "pixi.js";

const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 30;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const drawPanelBackground = (graphics, width, height, alpha = 0.88) => {
  graphics
    .clear()
    .roundRect(0, 0, width, height, 10)
    .fill({ color: 0x06120b, alpha })
    .stroke({ width: 1, color: 0x96ffe0, alpha: 0.34 });
};

export class DebugGridGameObject extends GameObject {
  constructor(props = {}) {
    super({
      enabled: false,
      frozenTime: 0,
      fillGraphics: null,
      gridGraphics: null,
      panel: null,
      panelBackground: null,
      panelLabel: null,
      ...props,
    });
  }

  setEnabled(enabled, nowSeconds = performance.now() * 0.001) {
    this.enabled = enabled;
    if (enabled) {
      this.frozenTime = nowSeconds;
    }
  }

  ensureSprite(scene) {
    if (this.sprite || !scene) return;
    this.sprite = new Container();
    this.sprite.zIndex = 55;
    this.fillGraphics = new Graphics();
    this.gridGraphics = new Graphics();
    this.sprite.addChild(this.fillGraphics, this.gridGraphics);
    scene.addChild(this.sprite);
  }

  ensurePanel(uiScene) {
    if (this.panel || !uiScene) return;
    this.panel = new Container();
    this.panel.zIndex = 56;
    this.panelBackground = new Graphics();
    this.panelLabel = new Text({
      text: "",
      style: {
        fill: 0xe6fff5,
        fontFamily: "Courier New",
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 1.4,
      },
    });
    this.panel.addChild(this.panelBackground, this.panelLabel);
    uiScene.addChild(this.panel);
  }

  worldRectToGridBounds(world, gridSize, x, y, w, h) {
    const cols = Math.max(1, Math.ceil(world.width / gridSize));
    const rows = Math.max(1, Math.ceil(world.height / gridSize));
    const left = clamp(Math.floor(x / gridSize), 0, cols - 1);
    const right = clamp(Math.ceil((x + w) / gridSize) - 1, 0, cols - 1);
    const bottom = clamp(Math.floor(y / gridSize), 0, rows - 1);
    const top = clamp(Math.ceil((y + h) / gridSize) - 1, 0, rows - 1);
    if (right < left || top < bottom) return null;
    return {
      left,
      right,
      bottom,
      top,
    };
  }

  heroToGridBounds(world, gridSize, heroX, heroY, heroWidth, heroHeight) {
    return this.worldRectToGridBounds(
      world,
      gridSize,
      heroX - heroWidth * 0.5,
      heroY,
      heroWidth,
      heroHeight,
    );
  }

  enemyToGridBounds(world, gridSize, enemy) {
    const cols = Math.max(1, Math.ceil(world.width / gridSize));
    const rows = Math.max(1, Math.ceil(world.height / gridSize));
    const footprintWidth = gridSize * 2;
    const footprintHeight = gridSize * 2;
    const left = clamp(
      Math.floor((enemy.x - footprintWidth * 0.5) / gridSize),
      0,
      Math.max(0, cols - 2),
    );
    const bottom = clamp(
      Math.floor(enemy.y / gridSize),
      0,
      Math.max(0, rows - 2),
    );
    return {
      left,
      right: Math.min(cols - 1, left + 1),
      bottom,
      top: Math.min(rows - 1, bottom + Math.max(1, Math.round(footprintHeight / gridSize)) - 1),
    };
  }

  coinToGridBounds(world, gridSize, coin) {
    const cols = Math.max(1, Math.ceil(world.width / gridSize));
    const rows = Math.max(1, Math.ceil(world.height / gridSize));
    const cellX = clamp(Math.floor(coin.x / gridSize), 0, cols - 1);
    const cellY = clamp(Math.floor(coin.y / gridSize), 0, rows - 1);
    return {
      left: cellX,
      right: cellX,
      bottom: cellY,
      top: cellY,
    };
  }

  drawGridCellBounds(bounds, color, viewport, basePixelScale, gridSize, alpha = 0.34) {
    if (!bounds || !this.fillGraphics) return;
    const cellSizePx = gridSize * basePixelScale;
    const leftPx = viewport.x + bounds.left * cellSizePx;
    const widthPx = (bounds.right - bounds.left + 1) * cellSizePx;
    const topPx = viewport.y + viewport.height - (bounds.top + 1) * cellSizePx;
    const heightPx = (bounds.top - bounds.bottom + 1) * cellSizePx;
    this.fillGraphics
      .rect(leftPx, topPx, widthPx, heightPx)
      .fill({ color, alpha });
  }

  syncPanel(viewport) {
    if (!this.panel || !this.panelBackground || !this.panelLabel) return;
    this.panel.visible = this.enabled;
    if (!this.enabled) return;
    this.panelLabel.text = "GRID DEBUG ON · FROZEN · F3 TO TOGGLE";
    drawPanelBackground(this.panelBackground, PANEL_WIDTH, PANEL_HEIGHT, 0.9);
    this.panel.x = viewport.x + 10;
    this.panel.y = viewport.y + 74;
    this.panelLabel.x = 10;
    this.panelLabel.y = 8;
  }

  syncRender(context = {}) {
    const {
      scene,
      uiScene,
      viewport,
      basePixelScale,
      platformGrid,
      world,
      player,
    } = context;

    this.ensureSprite(scene);
    this.ensurePanel(uiScene);
    if (!this.sprite || !this.gridGraphics || !this.fillGraphics || !viewport || !world) return;

    this.sprite.visible = this.enabled;
    this.gridGraphics.clear();
    this.fillGraphics.clear();
    if (!this.enabled) {
      this.syncPanel(viewport);
      return;
    }

    const cols = Math.max(1, Math.ceil(world.width / platformGrid));
    const rows = Math.max(1, Math.ceil(world.height / platformGrid));
    const cellSizePx = platformGrid * basePixelScale;
    const leftPx = viewport.x;
    const gridWidthPx = cols * cellSizePx;
    const gridHeightPx = rows * cellSizePx;
    const topPx = viewport.y + viewport.height - gridHeightPx;

    this.gridGraphics
      .rect(leftPx, topPx, gridWidthPx, gridHeightPx)
      .stroke({ width: 1, color: 0xd7fff2, alpha: 0.45 });

    for (let col = 1; col < cols; col++) {
      const x = leftPx + col * cellSizePx;
      this.gridGraphics
        .moveTo(x, topPx)
        .lineTo(x, topPx + gridHeightPx)
        .stroke({ width: 1, color: 0xb2fbe2, alpha: 0.16 });
    }

    for (let row = 1; row < rows; row++) {
      const y = topPx + row * cellSizePx;
      this.gridGraphics
        .moveTo(leftPx, y)
        .lineTo(leftPx + gridWidthPx, y)
        .stroke({ width: 1, color: 0xb2fbe2, alpha: 0.16 });
    }

    for (let i = 0; i < world.solids.length; i++) {
      const solid = world.solids[i];
      const solidBounds = this.worldRectToGridBounds(world, platformGrid, solid.x, solid.y, solid.w, solid.h);
      const color = solid.kind === "flyingPlatform" ? 0x77d8ff : (solid.kind === "stair" ? 0xffb66e : 0xff6f8f);
      this.drawGridCellBounds(solidBounds, color, viewport, basePixelScale, platformGrid, 0.28);
    }

    for (let i = 0; i < world.enemySpawns.length; i++) {
      this.drawGridCellBounds(
        this.enemyToGridBounds(world, platformGrid, world.enemySpawns[i]),
        0xff5e5e,
        viewport,
        basePixelScale,
        platformGrid,
        0.42,
      );
    }

    for (let i = 0; i < world.coins.length; i++) {
      this.drawGridCellBounds(
        this.coinToGridBounds(world, platformGrid, world.coins[i]),
        0xffe56a,
        viewport,
        basePixelScale,
        platformGrid,
        0.58,
      );
    }

    if (player) {
      this.drawGridCellBounds(
        this.heroToGridBounds(world, platformGrid, world.spawn.x, world.spawn.y, player.w, player.h),
        0x8cff8e,
        viewport,
        basePixelScale,
        platformGrid,
        0.42,
      );
    }

    this.drawGridCellBounds(
      this.worldRectToGridBounds(world, platformGrid, world.spawn.x - 0.5, world.spawn.y, 1, 1),
      0x8cff8e,
      viewport,
      basePixelScale,
      platformGrid,
      0.75,
    );

    this.syncPanel(viewport);
  }

  detachSprite({ destroy = false } = {}) {
    super.detachSprite({ destroy });
    this.fillGraphics = null;
    this.gridGraphics = null;

    if (this.panel?.parent) {
      this.panel.parent.removeChild(this.panel);
    }
    if (destroy) {
      this.panel?.destroy({ children: true });
    }
    this.panel = null;
    this.panelBackground = null;
    this.panelLabel = null;
  }
}
