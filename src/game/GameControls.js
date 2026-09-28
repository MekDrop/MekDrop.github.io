import { DEFAULT_CONTROLS } from "src/game/config/controls.js";
import { CameraDrag } from "src/game/controls/CameraDrag.js";
import { INPUT_EVENT_TYPE } from "src/game/enum/InputEventType.js";

export class GameControls {
  /**
   *
   * @type {HTMLElement}
   */
  #element;
  /**
   *
   * @type {Array}
   */
  #bindings = DEFAULT_CONTROLS;
  /**
   *
   * @type {Array}
   */
  #actions;
  /**
   *
   * @type {CameraDrag}
   */
  #cameraDrag;
  /**
   *
   * @type {null}
   */
  #inventoryPointerId = null;
  /**
   *
   * @type {Array}
   */
  #keydownConsumeBindings;
  /**
   *
   * @type {Map}
   */
  #keydownActions;
  /**
   *
   * @type {Map}
   */
  #keyupActions;

  /**
   *
   * @param {HTMLElement} element
   * @param {Array} actions
   * @param {{keydownActions: Array, keyupActions: Array, keydownConsumeBindings: Array}} options
   * @param {Array} options.keydownActions
   * @param {Array} options.keyupActions
   * @param {Array} options.keydownConsumeBindings
   */
  constructor(
    element,
    actions,
    {
      keydownActions = [],
      keyupActions = [],
      keydownConsumeBindings = [],
    } = {},
  ) {
    /**
     *
     * @type {HTMLElement}
     */
    this.#element = element;
    /**
     *
     * @type {Array}
     */
    this.#actions = actions;
    /**
     *
     * @type {CameraDrag}
     */
    this.#cameraDrag = new CameraDrag(element, actions, this.#config());
    /**
     *
     * @type {Array}
     */
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
    /**
     *
     * @type {Map}
     */
    this.#keydownActions = new Map(
      [
        ...this.#entriesFor(keydownActionNames),
        ...keydownActions.map(/**
         *
         * @param {{action: import("src/game/GameContracts.js").GameActionContract}} options
         * @param {string|{value: string, modifiers?: string[]}} options.binding
         * @param {import("src/game/GameContracts.js").GameActionContract} options.action
         */
        ({ binding, action }) => [binding, action]),
      ],
    );
    /**
     *
     * @type {Map}
     */
    this.#keyupActions = new Map(
      [
        ...this.#entriesFor([
          "regenerateMap",
          "run",
          "moveUp",
          "moveDown",
          "moveLeft",
          "moveRight",
        ]),
        ...keyupActions.map(/**
         *
         * @param {{action: import("src/game/GameContracts.js").GameActionContract}} options
         * @param {string|{value: string, modifiers?: string[]}} options.binding
         * @param {import("src/game/GameContracts.js").GameActionContract} options.action
         */
        ({ binding, action }) => [binding, action]),
      ],
    );
  }

  #config() {
    return this.#bindings;
  }

  /**
   *
   * @param {string[]} names
   */
  #entriesFor(names) {
    return names.map(/**
     *
     * @param {string} name
     */
    (name) => [this.#config()[name], this.#actions[name]]);
  }

  connect() {
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
   * @param {Event} event
   * @type {(event: Event) => void}
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
   * @param {Event} event
   * @type {(event: Event) => void}
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
    if (document.hidden) this.#clearMovement();
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
   * @param {Event} event
   * @type {(event: Event) => void}
   */
  #handleWheel = (event) => {
    event.preventDefault();
    if (this.#actions.toggleInventory?.visible) {
      return;
    }
    const rect = this.#element.getBoundingClientRect();
    const pivot = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const direction = event.deltaY < 0 ? "up" : "down";

    if (this.#config().zoomIn.wheelDirection === direction) {
      this.#actions.zoomIn.invoke(pivot);
    } else if (this.#config().zoomOut.wheelDirection === direction) {
      this.#actions.zoomOut.invoke(pivot);
    }
  };

  /**
   *
   * @param {Event} event
   * @type {(event: Event) => void}
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
   * @param {Event} event
   * @type {(event: Event) => void}
   */
  #handleCameraPointerMove = (event) => {
    this.#actions.cameraPointer?.move(event);
  };

  /**
   *
   * @param {Event} event
   * @type {(event: Event) => void}
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
   * @param {Event} event
   * @type {(event: Event) => void}
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
   * @param {Event} event
   * @param {Array} actions
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
   * @param {Event} event
   * @param {string|{value: string, modifiers?: string[]}} binding
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
   * @param {Event} event
   * @param {Array} bindings
   */
  #matchesAnyKey(event, bindings) {
    return bindings.some(/**
     *
     * @param {string|{value: string, modifiers?: string[]}} binding
     */
    (binding) => this.#matchesKey(event, binding));
  }

  /**
   *
   * @param {Event} event
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
   * @param {EventTarget|pc.Entity} target
   */
  #isEditable(target) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
  }
}
