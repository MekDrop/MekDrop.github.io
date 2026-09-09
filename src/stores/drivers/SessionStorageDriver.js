export class SessionStorageDriver {
  getItem(key) {
    if (typeof window === "undefined") {
      return null;
    }

    return window.sessionStorage.getItem(key);
  }

  setItem(key, value) {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(key, value);
  }
}

export const sessionStorageDriver = new SessionStorageDriver();
