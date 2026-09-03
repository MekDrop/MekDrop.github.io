import {
  GameModelAnimationMissingError,
  GameModelLoadError,
  GameModelUnavailableError,
} from "../errors/assets/index.js";

export class GameModelLibrary {
  #pc;
  #app;
  #assets = new Map();

  constructor({ pc, app }) {
    this.#pc = pc;
    this.#app = app;
  }

  async load(urls) {
    await Promise.all(
      [...new Set(urls)].map((url) => this.#loadModel(url)),
    );
  }

  instantiate(url) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) throw new GameModelUnavailableError({ url });

    const entity = asset.resource.instantiateRenderEntity({
      castShadows: false,
      receiveShadows: true,
    });
    this.#configureRenderHierarchy(entity);
    return entity;
  }

  getAnimationTracks(url, requiredNames = []) {
    const asset = this.#assets.get(url);
    if (!asset?.resource) throw new GameModelUnavailableError({ url });

    const tracks = new Map(
      (asset.resource.animations ?? []).map(({ resource }) => [
        resource.name,
        resource,
      ]),
    );
    for (const animation of requiredNames) {
      if (!tracks.has(animation)) {
        throw new GameModelAnimationMissingError({ url, animation });
      }
    }
    return tracks;
  }

  destroy() {
    for (const asset of this.#assets.values()) {
      asset.unload();
      this.#app?.assets.remove(asset);
    }
    this.#assets.clear();
  }

  #loadModel(url) {
    const asset = new this.#pc.Asset("Game model", "container", {
      url,
      filename: url.slice(url.lastIndexOf("/") + 1),
    });
    this.#app.assets.add(asset);

    return new Promise((resolve, reject) => {
      asset.ready((loadedAsset) => {
        this.#assets.set(url, loadedAsset);
        resolve();
      });
      asset.once("error", (cause) => {
        this.#app.assets.remove(asset);
        reject(new GameModelLoadError({ url, cause }));
      });
      this.#app.assets.load(asset);
    });
  }

  #configureRenderHierarchy(root) {
    const pending = [root];
    while (pending.length) {
      const entity = pending.pop();
      for (const meshInstance of entity.render?.meshInstances ?? []) {
        meshInstance.castShadow = false;
        meshInstance.receiveShadow = true;
      }
      pending.push(...entity.children);
    }
  }
}
