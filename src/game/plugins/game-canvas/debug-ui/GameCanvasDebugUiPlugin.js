import { useIntervalFn } from "@vueuse/core";

import { DevWireframeInspector } from "./debug/DevWireframeInspector.js";
import { PathArrowTextures } from "../../../rendering/terrain/PathArrowTextures.js";
import { DebugAxesHud } from "./ui/DebugAxesHud.js";
import { DebugFpsHud } from "./ui/DebugFpsHud.js";
import { DebugCastleRoomHud } from "../../../ui/DebugCastleRoomHud.js";
import { CastleRoomLocator } from "./debug/CastleRoomLocator.js";

export class GameCanvasDebugUiPlugin {
  /**
   *
   * @type {import("src/game/GameContracts.js").GameCanvasPluginContext}
   */
  #context;
  /**
   * @type {DebugCastleRoomHud|null}
   */
  #castleRoomHud = null;
  /**
   * @type {import("src/game/GameContracts.js").GameMapData|null}
   */
  #mapData = null;
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
    this.#castleRoomHud = new DebugCastleRoomHud({ pc, app });
    this.#castleRoomHud.attach();
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
        this.#syncCastleRoom();
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
    this.#mapData = null;
    this.#pathArrows?.clear();
    this.#devWireframeInspector?.refresh();
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").GameMapData} mapData
   */
  afterRender(mapData) {
    this.#mapData = mapData;
    this.#syncCastleRoom();
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
    this.#castleRoomHud?.resize(width, height);
  }

  destroy() {
    this.#castleRoomHud?.destroy();
    this.#castleRoomHud = null;
    this.#mapData = null;
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
    this.#castleRoomHud.visible = this.#context.debugStore.hasAny;
    this.#syncCastleRoom();
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

  #syncCastleRoom() {
    if (!this.#castleRoomHud || !this.#context.debugStore.hasAny) {
      return;
    }
    const position = this.#context.renderer().hero?.position;
    let message = "Outside castle";
    if (position) {
      for (const definition of this.#mapData?.objects ?? []) {
        const plan = definition.buildPlan?.metadata?.runtime?.residential;
        if (!plan?.origin) {
          continue;
        }
        const room = CastleRoomLocator.locate(plan, position);
        if (room) {
          const name = room.name ?? room.purpose ?? room.id;
          const label = String(name).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
          message = `Castle room: ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
          break;
        }
      }
    }
    this.#castleRoomHud.message = message;
  }

}
