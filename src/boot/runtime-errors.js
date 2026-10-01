import { Notify, copyToClipboard } from "quasar";
import { boot } from "quasar/wrappers";
import { useCountdown } from "@vueuse/core";

const INSTALLATION_KEY = Symbol.for("mekdrop.runtime-error-handler");
const RELOAD_DELAY_MS = 30_000;
const FALLBACK_TITLE = "Unexpected application error";
const FALLBACK_UNKNOWN = "An unknown error occurred.";
const FALLBACK_REFRESH = "Refresh ({seconds}s)";
const FALLBACK_DISMISS = "Dismiss";

/**
 * @typedef {Error|string|{message?: string}|null|undefined} RuntimeErrorInput
 */

let translate = null;
const activeSignatures = new Set();

/**
 *
 * @param {number} seconds
 */
function refreshLabel(seconds) {
  return translate?.("game.notification.refresh_countdown", { seconds }) ??
    FALLBACK_REFRESH.replace("{seconds}", seconds);
}

/**
 *
 * @param {import("quasar").QNotifyCreateOptions} notificationOptions
 * @param {string} signature
 * @param {string} details
 */
function schedulePageReload(notificationOptions, signature, details) {
  let updateNotification;
  let released = false;
  const copyDetails = async () => {
    let message;
    let type;
    try {
      await copyToClipboard(details);
      message = translate?.("game.notification.copied") ?? "Copied";
      type = "positive";
    } catch {
      message = translate?.("game.notification.copy_failed") ?? "Copy failed — retry";
      type = "warning";
    }
    Notify.create({ message, type, position: "bottom", timeout: 2000 });
  };

  const releaseSignature = () => {
    if (!released) {
      released = true;
      activeSignatures.delete(signature);
    }
  };

  const stopReloadTimer = () => {
    countdown.stop();
  };
  const reloadPage = () => {
    stopReloadTimer();
    window.location.reload();
  };
  const dismissError = () => {
    stopReloadTimer();
    releaseSignature();
    updateNotification();
  };
  /**
   *
   * @param {number} seconds
   */
  const optionsFor = (seconds) => ({
    ...notificationOptions,
    onDismiss: () => {
      stopReloadTimer();
      releaseSignature();
    },
    actions: [
      {
        label: translate?.("game.notification.copy_details") ?? "Copy details",
        icon: "fas fa-copy",
        style: { marginRight: "auto" },
        color: "white",
        noDismiss: true,
        handler: copyDetails,
      },
      {
        label: refreshLabel(seconds),
        icon: "fas fa-rotate-right",
        color: "white",
        handler: reloadPage,
      },
      {
        label: translate?.("game.notification.dismiss") ?? FALLBACK_DISMISS,
        icon: "fas fa-xmark",
        color: "white",
        handler: dismissError,
      },
    ],
  });
  updateNotification = Notify.create(optionsFor(RELOAD_DELAY_MS / 1000));

  const countdown = useCountdown(RELOAD_DELAY_MS / 1000, {
    onTick: () => {
      updateNotification(optionsFor(countdown.remaining.value));
    },
    onComplete: reloadPage,
  });
  countdown.start();
}

/**
 *
 * @param {RuntimeErrorInput} error
 */
export function runtimeErrorDescription(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (error && typeof error === "object" &&
    typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return translate?.("game.notification.runtime_error_unknown") ??
    FALLBACK_UNKNOWN;
}

/**
 * @param {RuntimeErrorInput} error
 * @param {string} context
 * @returns {string}
 */
export function runtimeErrorDetails(error, context) {
  const seen = new WeakSet();
  let serialized;
  try {
    serialized = JSON.stringify(error, /**
     *
     * @param {string} key
     * @param {Error|Record<string, RuntimeErrorInput>|string|number|boolean|bigint|null|undefined} value
     */
    (key, value) => {
      if (typeof value === "bigint") {
        return String(value);
      }
      if (value && typeof value === "object") {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
        if (value instanceof Error) {
          return Object.fromEntries(
            ["name", ...Object.getOwnPropertyNames(value)].map(/**
             *
             * @param {string} name
             */
            (name) => [name, value[name]]),
          );
        }
      }
      return value;
    }, 2);
  } catch {
    serialized = runtimeErrorDescription(error);
  }
  return [
    `Context: ${context}`,
    `Page: ${window.location?.href ?? ""}`,
    `Time: ${new Date().toISOString()}`,
    "",
    serialized ?? runtimeErrorDescription(error),
  ].join("\n");
}

/**
 * @param {RuntimeErrorInput} error
 * @param {{context?: string}} options
 * @param {string} options.context
 */
export function reportGlobalException(error, { context = "Application" } = {}) {
  const description = runtimeErrorDescription(error);
  const signature = `${context}:${description}`;
  console.error(`[${context}]`, error);
  if (typeof window === "undefined" ||
    activeSignatures.has(signature)) {
    return;
  }
  activeSignatures.add(signature);
  try {
    schedulePageReload({
      type: "negative",
      icon: "fas fa-triangle-exclamation",
      position: "top",
      message: translate?.("game.notification.unhandled_error") ?? FALLBACK_TITLE,
      caption: `${context}: ${description}`,
      timeout: 0,
      group: false,
      multiLine: true,
      attrs: {
        "data-global-exception": "true",
        role: "alert",
      },
    }, signature, runtimeErrorDetails(error, context));
  } catch (error) {
    activeSignatures.delete(signature);
    throw error;
  }
}

export default boot(/**
 *
 * @param {{app: import("vue").App}} options
 * @param {import("vue").App} options.app
 */
({ app }) => {
  const appTranslate = app.config.globalProperties.$t;
  if (typeof appTranslate === "function") {
    /**
     *
     * @param {string} key
     * @param {Record<string, string|number>} values
     */
    translate = (key, values) => appTranslate(key, values);
  }

  const previousVueErrorHandler = app.config.errorHandler;
  /**
   *
   * @param {RuntimeErrorInput} error
   * @param {import("vue").ComponentPublicInstance|null} instance
   * @param {string} info
   */
  app.config.errorHandler = (error, instance, info) => {
    reportGlobalException(error, { context: `Vue (${info})` });
    previousVueErrorHandler?.(error, instance, info);
  };

  if (typeof window === "undefined" || window[INSTALLATION_KEY]) {
    return;
  }
  window[INSTALLATION_KEY] = true;
  window.addEventListener("error", /**
   *
   * @param {ErrorEvent} event
   */
  (event) => {
    reportGlobalException(event.error ?? event.message);
    event.preventDefault();
  });
  window.addEventListener("unhandledrejection", /**
   *
   * @param {PromiseRejectionEvent} event
   */
  (event) => {
    reportGlobalException(event.reason, { context: "Promise" });
    event.preventDefault();
  });
});
