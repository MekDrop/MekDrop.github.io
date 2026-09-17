import { Notify } from "quasar";
import { boot } from "quasar/wrappers";

const INSTALLATION_KEY = Symbol.for("mekdrop.runtime-error-handler");
const DUPLICATE_WINDOW_MS = 1000;
const RELOAD_DELAY_MS = 30_000;
const FALLBACK_TITLE = "Unexpected application error";
const FALLBACK_UNKNOWN = "An unknown error occurred.";
const FALLBACK_REFRESH = "Refresh ({seconds}s)";
const FALLBACK_DISMISS = "Dismiss";

let translate = null;
let lastSignature = "";
let lastReportedAt = 0;

function refreshLabel(seconds) {
  return translate?.("game.notification.refresh_countdown", { seconds }) ??
    FALLBACK_REFRESH.replace("{seconds}", seconds);
}

function schedulePageReload(notificationOptions) {
  const reloadAt = Date.now() + RELOAD_DELAY_MS;
  let intervalId;
  let timeoutId;
  let updateNotification;

  const stopReloadTimer = () => {
    window.clearInterval(intervalId);
    window.clearTimeout(timeoutId);
  };
  const reloadPage = () => {
    stopReloadTimer();
    window.location.reload();
  };
  const dismissError = () => {
    stopReloadTimer();
    updateNotification();
  };
  const optionsFor = (seconds) => ({
    ...notificationOptions,
    actions: [
      {
        label: refreshLabel(seconds),
        color: "white",
        handler: reloadPage,
      },
      {
        label: translate?.("game.notification.dismiss") ?? FALLBACK_DISMISS,
        color: "white",
        handler: dismissError,
      },
    ],
  });
  updateNotification = Notify.create(optionsFor(RELOAD_DELAY_MS / 1000));

  intervalId = window.setInterval(() => {
    const seconds = Math.max(0, Math.ceil((reloadAt - Date.now()) / 1000));
    updateNotification(optionsFor(seconds));
  }, 1000);
  timeoutId = window.setTimeout(reloadPage, RELOAD_DELAY_MS);
}

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

export function reportGlobalException(error, { context = "Application" } = {}) {
  const description = runtimeErrorDescription(error);
  const signature = `${context}:${description}`;
  const reportedAt = Date.now();
  console.error(`[${context}]`, error);
  if (typeof window === "undefined" ||
    (signature === lastSignature &&
      reportedAt - lastReportedAt < DUPLICATE_WINDOW_MS)) {
    return;
  }
  lastSignature = signature;
  lastReportedAt = reportedAt;
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
  });
}

export default boot(({ app }) => {
  const appTranslate = app.config.globalProperties.$t;
  if (typeof appTranslate === "function") {
    translate = (key, values) => appTranslate(key, values);
  }

  const previousVueErrorHandler = app.config.errorHandler;
  app.config.errorHandler = (error, instance, info) => {
    reportGlobalException(error, { context: `Vue (${info})` });
    previousVueErrorHandler?.(error, instance, info);
  };

  if (typeof window === "undefined" || window[INSTALLATION_KEY]) {
    return;
  }
  window[INSTALLATION_KEY] = true;
  window.addEventListener("error", (event) => {
    reportGlobalException(event.error ?? event.message);
    event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportGlobalException(event.reason, { context: "Promise" });
    event.preventDefault();
  });
});
