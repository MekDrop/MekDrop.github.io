import { DEFAULT_CONTROLS } from "src/game/config/controls.js";
import { CameraDrag } from "src/game/controls/CameraDrag.js";
import { INPUT_EVENT_TYPE } from "src/game/enum/InputEventType.js";

export class GameControls {
  #element;
  #bindings = DEFAULT_CONTROLS;
  #actions;
  #cameraDrag;
  #inventoryPointerId = null;
  #keydownActions;
  #keyupActions;

  constructor(element, actions) {
    this.#element = element;
    this.#actions = actions;
    this.#cameraDrag = new CameraDrag(element, actions, this.#config());
    this.#keydownActions = new Map(
      this.#entriesFor([
        "copyScreenshot",
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
      ]),
    );
    this.#keyupActions = new Map(
      this.#entriesFor([
        "toggleRecording",
        "regenerateMap",
        "run",
        "moveUp",
        "moveDown",
        "moveLeft",
        "moveRight",
      ]),
    );
  }

  #config() {
    return this.#bindings;
  }

  #entriesFor(names) {
    return names.map((name) => [this.#config()[name], this.#actions[name]]);
  }

  connect() {
    window.addEventListener(INPUT_EVENT_TYPE.KEY_DOWN, this.#handleKeydown, true);
    window.addEventListener(INPUT_EVENT_TYPE.KEY_UP, this.#handleKeyup, true);
    window.addEventListener(INPUT_EVENT_TYPE.BLUR, this.#clearMovement);
    document.addEventListener(
      INPUT_EVENT_TYPE.VISIBILITY_CHANGE,
      this.#handleVisibilityChange,
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

  #handleKeydown = (event) => {
    if (this.#isEditable(event.target)) {
      return;
    }

    // Print Screen may only emit keyup on Windows. Toggle on release once.
    if (this.#matchesKey(event, this.#config().toggleRecording)) {
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

  #handleKeyup = (event) => {
    if (this.#isEditable(event.target)) {
      return;
    }

    this.#invokeKeyboardAction(event, this.#keyupActions);
  };

  #handleVisibilityChange = () => {
    if (document.hidden) this.#clearMovement();
  };

  #clearMovement = () => {
    this.#actions.heroMovement?.clear();
  };

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
    this.#cameraDrag.start(event);
  };

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

  #handlePointerLeave = () => {
    if (this.#actions.toggleInventory?.visible) {
      this.#actions.toggleInventory.leavePointer();
    }
  };

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

  #cancelKeyboardEvent(event) {
    event.preventDefault();
    event.returnValue = false;
    event.stopImmediatePropagation();
  }

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

  #isEditable(target) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
  }
}
