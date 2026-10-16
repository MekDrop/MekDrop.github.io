import { Vec2 } from "playcanvas";
import { DEFAULT_CONTROLS } from "src/game/config/controls.js";
import { CameraDrag } from "src/game/controls/CameraDrag.js";
import { INPUT_EVENT_TYPE } from "src/game/enum/InputEventType.js";

/**
 * Actions supplied by GameCanvas, including the optional development camera toggle.
 *
 * @typedef {object} ControlActions
 * @property {import("./actions/ZoomAction.js").ZoomAction} zoomIn
 * @property {import("./actions/ZoomAction.js").ZoomAction} zoomOut
 * @property {import("./actions/MoveCameraAction.js").MoveCameraAction} moveCamera
 * @property {import("./actions/CameraPointerAction.js").CameraPointerAction} cameraPointer
 * @property {import("./actions/RegenerateMapAction.js").RegenerateMapAction} regenerateMap
 * @property {import("./actions/RestartGameAction.js").RestartGameAction} restartGame
 * @property {import("./actions/HeroMovementAction.js").HeroMovementAction} heroMovement
 * @property {import("./actions/HeroMovementAction.js").HeroMovementAction} run
 * @property {import("./actions/HeroDirectionAction.js").HeroDirectionAction} moveUp
 * @property {import("./actions/HeroDirectionAction.js").HeroDirectionAction} moveDown
 * @property {import("./actions/HeroDirectionAction.js").HeroDirectionAction} moveLeft
 * @property {import("./actions/HeroDirectionAction.js").HeroDirectionAction} moveRight
 * @property {import("./actions/HeroJumpAction.js").HeroJumpAction} jump
 * @property {import("./actions/InteractionAction.js").InteractionAction} interact
 * @property {import("./actions/ToggleInventoryAction.js").ToggleInventoryAction} toggleInventory
 * @property {import("./actions/RotateViewAction.js").RotateViewAction} rotateView
 * @property {import("./actions/RotateViewAction.js").RotateViewAction} rotateAnticlockwise
 * @property {import("./actions/ToggleArrowsAction.js").ToggleArrowsAction} toggleArrows
 * @property {import("src/actions/CloseModalAction.js").CloseModalAction} closeModal
 * @property {import("./actions/FirstPersonCameraAction.js").FirstPersonCameraAction} [toggleFirstPersonCamera]
 */

export class GameControls {
  /**
   *
   * @type {HTMLElement}
   */
  #element;
  /**
   *
   * @type {typeof DEFAULT_CONTROLS}
   */
  #bindings = DEFAULT_CONTROLS;
  /**
   *
   * @type {ControlActions}
   */
  #actions;
  /**
   *
   * @type {CameraDrag}
   */
  #cameraDrag;
  /**
   *
   * @type {number|null}
   */
  #inventoryPointerId = null;
  /**
   *
   * @type {import("src/game/GameContracts.js").KeyboardBinding[]}
   */
  #keydownConsumeBindings;
  /**
   *
   * @type {Map<import("src/game/GameContracts.js").KeyboardBinding, import("src/game/GameContracts.js").KeyboardAction>}
   */
  #keydownActions;
  /**
   *
   * @type {Map<import("src/game/GameContracts.js").KeyboardBinding, import("src/game/GameContracts.js").KeyboardAction>}
   */
  #keyupActions;

  /**
   * @type {Array<{action: import("src/game/GameContracts.js").DoubleClickAction}>}
   */
  #doubleClickActions;

  /**
   *
   * @param {HTMLElement} element
   * @param {ControlActions} actions
   * @param {import("src/game/GameContracts.js").ControlKeyboardOptions} [options]
   * @param {import("src/game/GameContracts.js").KeyboardActionBinding[]} [options.keydownActions]
   * @param {import("src/game/GameContracts.js").KeyboardActionBinding[]} [options.keyupActions]
   * @param {import("src/game/GameContracts.js").KeyboardBinding[]} [options.keydownConsumeBindings]
   * @param {Array<{action: import("src/game/GameContracts.js").DoubleClickAction}>} [options.doubleClickActions]
   */
  constructor(
    element,
    actions,
    {
      keydownActions = [],
      keyupActions = [],
      keydownConsumeBindings = [],
      doubleClickActions = [],
    } = {},
  ) {
    this.#element = element;
    this.#actions = actions;
    this.#doubleClickActions = doubleClickActions;
    this.#cameraDrag = new CameraDrag(element, actions, this.#config());
    this.#keydownConsumeBindings = keydownConsumeBindings;
    const keydownActionNames = [
      "regenerateMap",
      "toggleInventory",
      "closeModal",
      "run",
      "moveUp",
      "moveDown",
      "moveLeft",
      "moveRight",
      "jump",
      "interact",
      "zoomIn",
      "zoomOut",
      "rotateAnticlockwise",
      "toggleArrows",
    ];
    if (this.#actions.toggleFirstPersonCamera) {
      keydownActionNames.push("toggleFirstPersonCamera");
    }
    this.#keydownActions = new Map([
      ...this.#entriesFor(keydownActionNames),
      ...keydownActions.map(GameControls.#map),
    ]);
    this.#keyupActions = new Map([
      ...this.#entriesFor([
        "regenerateMap",
        "run",
        "moveUp",
        "moveDown",
        "moveLeft",
        "moveRight",
      ]),
      ...keyupActions.map(GameControls.#map2),
    ]);
  }

  #config() {
    return this.#bindings;
  }

  /**
   *
   * @param {Array<keyof typeof DEFAULT_CONTROLS & keyof ControlActions>} names
   * @returns {Array<[import("src/game/GameContracts.js").KeyboardBinding, import("src/game/GameContracts.js").KeyboardAction]>}
   */
  #entriesFor(names) {
    return names.map(this.#mapName.bind(this));
  }

  connect() {
    this.#element.addEventListener(
      INPUT_EVENT_TYPE.DOUBLE_CLICK,
      this.#handleDoubleClick,
    );
    window.addEventListener(INPUT_EVENT_TYPE.KEY_DOWN, this.#handleKeydown, true);
    window.addEventListener(INPUT_EVENT_TYPE.KEY_UP, this.#handleKeyup, true);
    window.addEventListener(INPUT_EVENT_TYPE.BLUR, this.#clearMovement);
    document.addEventListener(
      INPUT_EVENT_TYPE.VISIBILITY_CHANGE,
      this.#handleVisibilityChange,
    );
    document.addEventListener(
      INPUT_EVENT_TYPE.MOUSE_MOVE,
      this.#handleCameraPointerMove,
    );
    this.#element.addEventListener(INPUT_EVENT_TYPE.WHEEL, this.#handleWheel, {
      passive: false,
    });
    this.#element.addEventListener(
      INPUT_EVENT_TYPE.POINTER_DOWN,
      this.#handlePointerDown,
    );
    this.#element.addEventListener(
      INPUT_EVENT_TYPE.POINTER_MOVE,
      this.#handlePointerMove,
    );
    this.#element.addEventListener(
      INPUT_EVENT_TYPE.POINTER_UP,
      this.#handlePointerUp,
    );
    this.#element.addEventListener(
      INPUT_EVENT_TYPE.POINTER_CANCEL,
      this.#handlePointerUp,
    );
    this.#element.addEventListener(
      INPUT_EVENT_TYPE.POINTER_LEAVE,
      this.#handlePointerLeave,
    );
  }

  disconnect() {
    this.#element.removeEventListener(
      INPUT_EVENT_TYPE.DOUBLE_CLICK,
      this.#handleDoubleClick,
    );
    window.removeEventListener(INPUT_EVENT_TYPE.KEY_DOWN, this.#handleKeydown, true);
    window.removeEventListener(INPUT_EVENT_TYPE.KEY_UP, this.#handleKeyup, true);
    window.removeEventListener(INPUT_EVENT_TYPE.BLUR, this.#clearMovement);
    document.removeEventListener(
      INPUT_EVENT_TYPE.VISIBILITY_CHANGE,
      this.#handleVisibilityChange,
    );
    document.removeEventListener(
      INPUT_EVENT_TYPE.MOUSE_MOVE,
      this.#handleCameraPointerMove,
    );
    this.#actions.cameraPointer?.release();
    this.#element.removeEventListener(INPUT_EVENT_TYPE.WHEEL, this.#handleWheel);
    this.#element.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_DOWN,
      this.#handlePointerDown,
    );
    this.#element.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_MOVE,
      this.#handlePointerMove,
    );
    this.#element.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_UP,
      this.#handlePointerUp,
    );
    this.#element.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_CANCEL,
      this.#handlePointerUp,
    );
    this.#element.removeEventListener(
      INPUT_EVENT_TYPE.POINTER_LEAVE,
      this.#handlePointerLeave,
    );
    this.#cameraDrag.cancel();
    this.#clearMovement();
  }

  /**
   *
   * @param {KeyboardEvent} event
   * @type {(event: KeyboardEvent) => void}
   */
  #handleKeydown = (event) => {
    if (this.#isEditable(event.target)) {
      return;
    }

    if (this.#matchesAnyKey(event, this.#keydownConsumeBindings)) {
      this.#cancelKeyboardEvent(event);

      return;
    }

    if (!event.repeat && this.#actions.restartGame?.restart()) {
      event.preventDefault();
      event.stopImmediatePropagation();

      return;
    }

    if (this.#invokeKeyboardAction(event, this.#keydownActions)) {
      return;
    }

    if (this.#actions.toggleInventory?.visible) {
      this.#cancelKeyboardEvent(event);
    }
  };

  /**
   *
   * @param {KeyboardEvent} event
   * @type {(event: KeyboardEvent) => void}
   */
  #handleKeyup = (event) => {
    if (this.#isEditable(event.target)) {
      return;
    }

    this.#invokeKeyboardAction(event, this.#keyupActions);
  };

  /**
   *
   * @type {() => void}
   */
  #handleVisibilityChange = () => {
    if (document.hidden) {
      this.#clearMovement();
    }
  };

  /**
   *
   * @type {() => void}
   */
  #clearMovement = () => {
    this.#actions.heroMovement?.clear();
  };

  /**
   *
   * @param {MouseEvent} event
   * @type {(event: MouseEvent) => void}
   */
  #handleDoubleClick = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    for (const { action } of this.#doubleClickActions) {
      if (action.invoke(event)) {
        event.preventDefault();
        this.#cameraDrag.cancel();
        this.#clearMovement();

        return;
      }
    }
  };

  /**
   * @param {WheelEvent} event
   * @type {(event: WheelEvent) => void}
   */
  #handleWheel = (event) => {
    event.preventDefault();
    if (this.#actions.toggleInventory?.visible) {
      return;
    }
    const rect = this.#element.getBoundingClientRect();
    const pivot = new Vec2(event.clientX - rect.left, event.clientY - rect.top);
    const direction = event.deltaY < 0 ? "up" : "down";

    if (this.#config().zoomIn.wheelDirection === direction) {
      this.#actions.zoomIn.invoke(pivot);
    } else if (this.#config().zoomOut.wheelDirection === direction) {
      this.#actions.zoomOut.invoke(pivot);
    }
  };

  /**
   *
   * @param {PointerEvent} event
   * @type {(event: PointerEvent) => void}
   */
  #handlePointerDown = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (this.#actions.toggleInventory?.visible) {
      event.preventDefault();
      const pressed = this.#actions.toggleInventory.pressPointer(
        event.clientX,
        event.clientY,
      );
      if (pressed) {
        this.#inventoryPointerId = event.pointerId;
        this.#element.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (this.#actions.restartGame?.restart()) {
      event.preventDefault();
      event.stopImmediatePropagation();

      return;
    }
    if (this.#actions.cameraPointer?.press(event)) {
      event.preventDefault();

      return;
    }
    this.#cameraDrag.start(event);
  };

  /**
   *
   * @param {MouseEvent} event
   * @type {(event: MouseEvent) => void}
   */
  #handleCameraPointerMove = (event) => {
    this.#actions.cameraPointer?.move(event);
  };

  /**
   *
   * @param {PointerEvent} event
   * @type {(event: PointerEvent) => void}
   */
  #handlePointerMove = (event) => {
    if (this.#actions.toggleInventory?.visible) {
      event.preventDefault();
      this.#actions.toggleInventory.movePointer(
        event.clientX,
        event.clientY,
      );

      return;
    }
    this.#cameraDrag.move(event);
  };

  /**
   *
   * @param {PointerEvent} event
   * @type {(event: PointerEvent) => void}
   */
  #handlePointerUp = (event) => {
    if (event.pointerId === this.#inventoryPointerId) {
      event.preventDefault();
      this.#inventoryPointerId = null;
      if (event.type === INPUT_EVENT_TYPE.POINTER_CANCEL) {
        this.#actions.toggleInventory.cancelPointer();
      } else {
        this.#actions.toggleInventory.releasePointer(
          event.clientX,
          event.clientY,
        );
      }
      if (this.#element.hasPointerCapture(event.pointerId)) {
        this.#element.releasePointerCapture(event.pointerId);
      }
      return;
    }
    this.#cameraDrag.end(event);
  };

  /**
   *
   * @type {() => void}
   */
  #handlePointerLeave = () => {
    if (this.#actions.toggleInventory?.visible) {
      this.#actions.toggleInventory.leavePointer();
    }
  };

  /**
   *
   * @param {KeyboardEvent} event
   * @param {Map<import("src/game/GameContracts.js").KeyboardBinding, import("src/game/GameContracts.js").KeyboardAction>} actions
   */
  #invokeKeyboardAction(event, actions) {
    for (const [binding, action] of actions) {
      if (!this.#matchesKey(event, binding)) {
        continue;
      }

      this.#cancelKeyboardEvent(event);
      action.invoke(event);

      return true;
    }

    return false;
  }

  /**
   *
   * @param {Event} event
   */
  #cancelKeyboardEvent(event) {
    event.preventDefault();
    event.returnValue = false;
    event.stopImmediatePropagation();
  }

  /**
   *
   * @param {KeyboardEvent} event
   * @param {import("src/game/GameContracts.js").KeyboardBinding} binding
   */
  #matchesKey(event, binding) {
    if (!binding?.keys?.length) {
      return false;
    }

    if (
      !binding.keys.includes(event.code) &&
      !binding.keys.includes(event.key)
    ) {
      return false;
    }

    const modifierKeys = ["altKey", "ctrlKey", "metaKey", "shiftKey"];
    const eventModifierKey = this.#eventModifierKey(event);
    for (const modifierKey of modifierKeys) {
      if (
        modifierKey === eventModifierKey ||
        binding.allowedModifiers?.includes(modifierKey)
      ) {
        continue;
      }
      if (Boolean(binding[modifierKey]) !== Boolean(event[modifierKey])) {
        return false;
      }
    }

    return binding.allowRepeat !== false || !event.repeat;
  }

  /**
   *
   * @param {KeyboardEvent} event
   * @param {import("src/game/GameContracts.js").KeyboardBinding[]} bindings
   */
  #matchesAnyKey(event, bindings) {
    return bindings.some(/**
     *
     * @param {import("src/game/GameContracts.js").KeyboardBinding} binding
     */
      (binding) => this.#matchesKey(event, binding));
  }

  /**
   *
   * @param {KeyboardEvent} event
   */
  #eventModifierKey(event) {
    if (["Alt", "AltLeft", "AltRight"].includes(event.code)) {
      return "altKey";
    }
    if (["Control", "ControlLeft", "ControlRight"].includes(event.code)) {
      return "ctrlKey";
    }
    if (["Meta", "MetaLeft", "MetaRight"].includes(event.code)) {
      return "metaKey";
    }
    if (["Shift", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      return "shiftKey";
    }
    return null;
  }

  /**
   *
   * @param {EventTarget|null} target
   */
  #isEditable(target) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").KeyboardActionBinding} options
   * @param {import("src/game/GameContracts.js").KeyboardBinding} options.binding
   * @param {import("src/game/GameContracts.js").KeyboardAction} options.action
   * @returns {[import("src/game/GameContracts.js").KeyboardBinding, import("src/game/GameContracts.js").KeyboardAction]}
   */
  static #map({ binding, action }) {
    return [binding, action];
  }

  /**
   *
   * @param {import("src/game/GameContracts.js").KeyboardActionBinding} options
   * @param {import("src/game/GameContracts.js").KeyboardBinding} options.binding
   * @param {import("src/game/GameContracts.js").KeyboardAction} options.action
   * @returns {[import("src/game/GameContracts.js").KeyboardBinding, import("src/game/GameContracts.js").KeyboardAction]}
   */
  static #map2({ binding, action }) {
    return [binding, action];
  }

  /**
   *
   * @param {keyof typeof DEFAULT_CONTROLS & keyof ControlActions} name
   * @returns {[import("src/game/GameContracts.js").KeyboardBinding, import("src/game/GameContracts.js").KeyboardAction]}
   */
  #mapName(name) {
    return [this.#config()[name], this.#actions[name]];
  }
}
