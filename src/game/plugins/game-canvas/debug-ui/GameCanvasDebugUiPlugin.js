import { useIntervalFn } from "@vueuse/core";

import { DevWireframeInspector } from "./debug/DevWireframeInspector.js";
import { PathArrows } from "./objects/path/PathArrows.js";
import { DebugAxesHud } from "./ui/DebugAxesHud.js";
import { DebugFpsHud } from "./ui/DebugFpsHud.js";

export class GameCanvasDebugUiPlugin {
  #context;
  #debugAxesHud = null;
  #debugFpsHud = null;
  #devWireframeInspector = null;
  #pathArrows = null;
  #debugStatsTimer = null;
  #stopDebugStoreSubscription = null;

  constructor(context) {
    this.#context = context;
  }

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
    this.#pathArrows = new PathArrows({ pc, app });
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

  afterRender(mapData) {
    const mapRoot = this.#context.renderer().mapRoot;
    if (!mapRoot) {
      return;
    }
    mapRoot.addChild(this.#pathArrows.render(mapData));
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
