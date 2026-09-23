import { useIntervalFn } from "@vueuse/core";

import {
  DebugAxesHud,
  DebugFpsHud,
  GameUiTheme,
} from "../../ui/index.js";

export class GameCanvasDebugUiPlugin {
  #context;
  #debugAxesHud = null;
  #debugFpsHud = null;
  #debugStatsTimer = null;
  #stopDebugStoreSubscription = null;
  #theme = null;

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
    this.#theme = new GameUiTheme(this.#context.uiTheme());
    this.#debugFpsHud = new DebugFpsHud({
      pc,
      app,
      theme: this.#theme,
    });
    this.#debugFpsHud.attach();
    this.#debugAxesHud = new DebugAxesHud({
      pc,
      app,
      gameCanvas: renderer,
      theme: this.#theme,
    });
    this.#debugAxesHud.attach();
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
    this.#debugAxesHud?.destroy();
    this.#debugAxesHud = null;
    this.#debugFpsHud?.destroy();
    this.#debugFpsHud = null;
    this.#theme = null;
  }

  #applyDebugSettings() {
    this.#debugAxesHud.visible = this.#context.debugStore.debugAxesHud;
    this.#debugFpsHud.visible = this.#context.debugStore.debugFpsHud;
  }

  #syncDebugFramesPerSecond() {
    this.#context.debugStore.framesPerSecond =
      this.#debugFpsHud?.framesPerSecond ?? 0;
  }
}
