import { GamePanelHud } from "./GamePanelHud.js";
import { gameUiTheme } from "./GameUiTheme.js";

/**
 * Capability colours are stable across the HUD and the world route lanes.
 */
export class EnemyPathLegendHud extends GamePanelHud {
  /**
   * @param {{pc:typeof import("playcanvas"),app:import("playcanvas").Application}} options
   */
  constructor(options) {
    super({
      ...options,
      name: "Enemy path legend",
      priority: 106,
    });

    const width = 440;
    const height = 62;
    const record = this.createTextureRecord("Enemy path legend", width * 2, height * 2);
    const context = record.context;
    context.scale(2, 2);
    this.drawPanelFrame(context, width, height);
    context.font = gameUiTheme.font(700, 12);
    context.textBaseline = "middle";
    context.fillStyle = "#ffa626";
    context.fillText("WALK: wait / reroute", 14, 18);
    context.fillStyle = "#1ae6ff";
    context.fillText("FLY: cross", 262, 18);
    context.fillStyle = "#d966ff";
    context.fillText("JUMP: cross one missing tile; wait at wider gaps", 14, 43);
    record.texture.setSource(record.canvas);
    const panel = this.createPanel({
      name: "Enemy routes",
      x: 0,
      y: 0,
      width,
      height,
    });
    panel.element.anchor = new this.pc.Vec4(0.5, 0, 0.5, 0);
    panel.setLocalPosition(-width / 2, height + 18, 0);
    this.createImage({
      parent: panel,
      name: "Enemy route key",
      x: 0,
      y: 0,
      width,
      height,
      texture: record.texture,
    });
    this.syncDrawOrder();
    this.visible = false;
  }
}
