import assert from "node:assert/strict";
import { it } from "node:test";
import { Notify } from "quasar";

const importWindow = globalThis.window;
const importDocument = globalThis.document;
globalThis.window = importWindow ?? {};
globalThis.document = importDocument ?? {};
const {
  reportGlobalException,
  runtimeErrorDescription,
} = await import("../../../src/boot/runtime-errors.js");
globalThis.window = importWindow;
globalThis.document = importDocument;

it("preserves useful details from global exceptions", () => {
  assert.equal(runtimeErrorDescription(new TypeError("bad animation")),
    "bad animation");
  assert.equal(runtimeErrorDescription({ message: "rejected render" }),
    "rejected render");
  assert.equal(runtimeErrorDescription("plain failure"), "plain failure");
});

it("provides a safe description for unknown rejection values", () => {
  assert.equal(runtimeErrorDescription(null), "An unknown error occurred.");
});

it("suppresses open duplicate errors and allows them again after dismissal", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalNow = Date.now;
  const notifications = [];
  let now = 100_000;
  let timers = 0;

  try {
    Notify.create = (options) => {
      notifications.push(options);
      return () => null;
    };
    console.error = () => null;
    globalThis.window = { location: { reload: () => null } };
    globalThis.setInterval = () => ++timers;
    globalThis.clearInterval = () => null;
    Date.now = () => now;

    reportGlobalException("first duplicate");
    now += 5_000;
    reportGlobalException("first duplicate");
    reportGlobalException("different exception");
    reportGlobalException("first duplicate");
    assert.equal(notifications.length, 2);
    assert.equal(timers, 2);

    notifications[0].actions[2].handler();
    reportGlobalException("first duplicate");
    assert.equal(notifications.length, 3);

    notifications[1].onDismiss();
    reportGlobalException("different exception");
    assert.equal(notifications.length, 4);
    notifications[2].actions[2].handler();
    notifications[3].actions[2].handler();
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    Date.now = originalNow;
  }
});

it("counts down and reloads immediately from the recovery action", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalNow = Date.now;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let now = 10_000;
  let notification;
  let intervalCallback;
  let reloaded = 0;
  const clearedIntervals = [];

  try {
    Notify.create = (options) => {
      notification = options;
      return (updatedOptions) => {
        notification = updatedOptions;
      };
    };
    console.error = () => null;
    Date.now = () => now;
    globalThis.clearInterval = (id) => clearedIntervals.push(id);
    globalThis.setInterval = (callback) => {
      intervalCallback = callback;
      return 11;
    };
    globalThis.window = {
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
    };

    reportGlobalException("reload recovery", { context: "Countdown test" });
    assert.equal(notification.actions[1].label, "Refresh (30s)");

    now += 1_001;
    intervalCallback();
    assert.equal(notification.actions[1].label, "Refresh (29s)");

    notification.actions[1].handler();
    assert.equal(reloaded, 1);
    assert.deepEqual(clearedIntervals, [11]);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    Date.now = originalNow;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

it("reloads automatically when the recovery timer expires", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let intervalCallback;
  let reloaded = 0;

  try {
    Notify.create = () => () => null;
    console.error = () => null;
    globalThis.clearInterval = () => null;
    globalThis.setInterval = (callback) => {
      intervalCallback = callback;
      return 21;
    };
    globalThis.window = {
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
    };

    reportGlobalException("automatic recovery", { context: "Timer test" });
    for (let remainingSeconds = 30; remainingSeconds > 0; remainingSeconds -= 1) {
      intervalCallback();
    }
    assert.equal(reloaded, 1);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

it("dismisses the recovery notification and cancels its reload timer", () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let notification;
  let dismissed = 0;
  let reloaded = 0;
  const clearedIntervals = [];

  try {
    Notify.create = (options) => {
      notification = options;
      return (updatedOptions) => {
        if (updatedOptions) {
          notification = updatedOptions;
          return;
        }
        dismissed += 1;
      };
    };
    console.error = () => null;
    globalThis.clearInterval = (id) => clearedIntervals.push(id);
    globalThis.setInterval = () => 31;
    globalThis.window = {
      location: {
        reload: () => {
          reloaded += 1;
        },
      },
    };

    reportGlobalException("dismiss recovery", { context: "Dismiss test" });
    assert.equal(notification.actions[2].label, "Dismiss");
    notification.actions[2].handler();

    assert.equal(dismissed, 1);
    assert.equal(reloaded, 0);
    assert.deepEqual(clearedIntervals, [31]);
  } finally {
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

it("copies full error details and reports clipboard failures without dismissing", async () => {
  const originalCreate = Notify.create;
  const originalError = console.error;
  const originalWindow = globalThis.window;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  let notification;
  let copied;
  const feedback = [];
  let failCopy = false;
  let dismissed = 0;
  let stopped = 0;
  try {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          if (failCopy) {
            throw new TypeError("clipboard denied");
          }
          copied = text;
        },
      },
    });
    Notify.create = (options) => {
      if (!options.actions) {
        feedback.push(options);
        return () => null;
      }
      notification = options;
      return (updated) => {
        if (updated) {
          notification = updated;
        } else {
          dismissed += 1;
        }
      };
    };
    console.error = () => null;
    globalThis.window = { location: { href: "https://example.test/game" } };
    globalThis.setInterval = () => 41;
    globalThis.clearInterval = () => { stopped += 1; };
    const cause = new TypeError("underlying failure");
    const error = new TypeError("copy recovery", { cause });
    error.code = "RENDER_FAILED";
    error.self = error;
    reportGlobalException(error, { context: "Copy test" });
    assert.equal(notification.actions[0].label, "Copy details");
    assert.equal(notification.actions[0].noDismiss, true);
    await notification.actions[0].handler();
    assert.match(copied, /Context: Copy test/);
    assert.match(copied, /https:\/\/example.test\/game/);
    assert.match(copied, /Time: /);
    assert.match(copied, /TypeError/);
    assert.match(copied, /"stack":/);
    assert.match(copied, /underlying failure/);
    assert.match(copied, /RENDER_FAILED/);
    assert.match(copied, /\[Circular\]/);
    assert.equal(notification.actions[0].label, "Copy details");
    assert.equal(feedback[0].message, "Copied");
    failCopy = true;
    await notification.actions[0].handler();
    assert.equal(notification.actions[0].label, "Copy details");
    assert.equal(feedback[1].message, "Copy failed — retry");
    assert.equal(dismissed, 0);
    assert.equal(stopped, 0);
    notification.actions[2].handler();
  } finally {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      delete navigator.clipboard;
    }
    Notify.create = originalCreate;
    console.error = originalError;
    globalThis.window = originalWindow;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});