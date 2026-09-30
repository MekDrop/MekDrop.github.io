import { useIntervalFn } from "@vueuse/core";

import { DevWireframeInspector } from "./debug/DevWireframeInspector.js";
import { PathArrowTextures } from "../../../rendering/terrain/PathArrowTextures.js";
import { DebugAxesHud } from "./ui/DebugAxesHud.js";
import { DebugFpsHud } from "./ui/DebugFpsHud.js";

export class GameCanvasDebugUiPlugin {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   *
   * @type {null}
   */
  #debugAxesHud = null;
  /**
   *
   * @type {null}
   */
  #debugFpsHud = null;
  /**
   *
   * @type {null}
   */
  #devWireframeInspector = null;
  /**
   *
   * @type {null}
   */
  #pathArrows = null;
  /**
   *
   * @type {null}
   */
  #debugStatsTimer = null;
  /**
   *
   * @type {null}
   */
  #stopDebugStoreSubscription = null;

  /**
   *
   * @param {import("src/game/GameContracts.js").GameCanvasPluginContext} context
   */
  constructor(context) {
    /**
     *
     * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
     */
    this.#context = context;
  }

  /**
   *
   * @returns {number}
   */
  static get #DEBUG_STATS_UPDATE_INTERVAL() {
    return 100;
  }

  install() {
    const renderer = this.#context.renderer();
    const pc = renderer.playCanvas;
    const app = renderer.app;
    this.#debugFpsHud = new DebugFpsHud({ pc, app });
    this.#debugFpsHud.attach();
    this.#debugAxesHud = new DebugAxesHud({
      pc,
      app,
      gameCanvas: renderer,
    });
    this.#debugAxesHud.attach();
    this.#pathArrows = new PathArrowTextures({ pc, app });
    if (import.meta.env.DEV) {
      this.#devWireframeInspector = new DevWireframeInspector({
        pc,
        app,
        canvas: renderer.canvasElement,
        camera: renderer.camera.camera,
      });
    }
    this.resize();
    this.#applyDebugSettings();
    this.#syncDebugFramesPerSecond();
    this.#debugStatsTimer = useIntervalFn(() => {
      if (this.#context.debugStore.hasAny) {
        this.#syncDebugFramesPerSecond();
      }
    }, GameCanvasDebugUiPlugin.#DEBUG_STATS_UPDATE_INTERVAL);
    this.#stopDebugStoreSubscription = this.#context.debugStore.$subscribe(
      () => {
        this.#applyDebugSettings();
        this.#syncDebugFramesPerSecond();
      },
    );
  }

  beforeRender() {
    this.#pathArrows?.clear();
    this.#devWireframeInspector?.refresh();
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  afterRender(mapData) {
    const mapRoot = this.#context.renderer().mapRoot;
    if (!mapRoot) {
      return;
    }
    this.#pathArrows.render(mapData, mapRoot);
  }

  resize() {
    const container = this.#context.container();
    if (!container) {
      return;
    }
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.#debugAxesHud?.resize(width, height);
    this.#debugFpsHud?.resize(width, height);
  }

  destroy() {
    if (this.#debugStatsTimer !== null) {
      this.#debugStatsTimer.pause();
      this.#debugStatsTimer = null;
    }
    this.#stopDebugStoreSubscription?.();
    this.#stopDebugStoreSubscription = null;
    this.#context.debugStore.framesPerSecond = 0;
    this.#devWireframeInspector?.destroy();
    this.#devWireframeInspector = null;
    this.#pathArrows?.destroy();
    this.#pathArrows = null;
    this.#debugAxesHud?.destroy();
    this.#debugAxesHud = null;
    this.#debugFpsHud?.destroy();
    this.#debugFpsHud = null;
  }

  #applyDebugSettings() {
    this.#pathArrows.visible = this.#context.debugStore.pathArrows;
    this.#debugAxesHud.visible = this.#context.debugStore.debugAxesHud;
    this.#debugFpsHud.visible = this.#context.debugStore.debugFpsHud;
    if (this.#context.debugStore.hasAny) {
      this.#devWireframeInspector?.connect();
    } else {
      this.#devWireframeInspector?.disconnect();
    }
  }

  #syncDebugFramesPerSecond() {
    this.#context.debugStore.framesPerSecond =
      this.#debugFpsHud?.framesPerSecond ?? 0;
  }
}
