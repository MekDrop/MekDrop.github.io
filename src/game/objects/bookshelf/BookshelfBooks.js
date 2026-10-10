/**
 * Replaces baked shelf books with one reusable, independently tinted Tripo asset.
 */
export class BookshelfBooks {
  /**
   * Shelf plank tops and clearance below the next plank, measured from bookcase.glb.
   * @type {{bottom:number,height:number}[]}
   */
  static levels = [{ bottom: 0.08, height: 0.29 }, { bottom: 0.42, height: 0.31 },
    { bottom: 0.78, height: 0.30 }, { bottom: 1.13, height: 0.145 }];
  /**
   * @type {number[][]}
   */
  static colors = [[0.65, 0.22, 0.22], [0.20, 0.38, 0.62], [0.27, 0.48, 0.30],
    [0.62, 0.43, 0.22], [0.45, 0.28, 0.52], [0.33, 0.24, 0.19]];

  /**
   * @param {import("../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} shelf
   * @param {string} bookUrl
   * @param {() => number} random
   * @param {{bottom:number,height:number}[]} [levels]
   */
  static populate(models, shelf, bookUrl, random = Math.random, levels = this.levels) {
    for (const node of shelf.find(/**
     * @param {import("playcanvas").GraphNode} node
     */
    (node) => /^(Leather bound book|Book spine brass)/.test(node.name))) {
      node.destroy();
    }
    const materials = new Map();
    shelf.once("destroy", () => {
      for (const material of materials.values()) { material.destroy(); }
    });
    for (const [row, level] of levels.entries()) {
      const horizontal = level.height < 0.24;
      const count = horizontal ? 6 : 10;
      const widths = Array.from({ length: count }, () => horizontal ? 0.032 + random() * 0.008 : 0.04 + random() * 0.025);
      const total = widths.reduce(/**
       * @param {number} sum
       * @param {number} width
       */
      (sum, width) => sum + width, 0);
      const gap = 0, factor = horizontal ? 1 : 0.71 / total;
      let cursor = -0.355;
      let stackHeight = 0;
      let groupHeight = Math.min(level.height - 0.015, 0.265) * (0.93 + random() * 0.07);
      let groupColor = Math.floor(random() * this.colors.length);
      for (const [index, sample] of widths.entries()) {
        const width = sample * factor;
        if (index % 3 === 0) {
          groupHeight = horizontal ? 0.23 + random() * 0.025 : Math.min(level.height - 0.015, 0.265) * (0.93 + random() * 0.07);
          groupColor = Math.floor(random() * this.colors.length);
          stackHeight = 0;
        }
        const height = groupHeight * (0.97 + random() * 0.03);
        const depth = 0.20 * height / 0.26;
        const color = random() < 0.75 ? groupColor : Math.floor(random() * this.colors.length);
        const book = models.instantiate(bookUrl);
        book.name = `Shelf book ${row}-${index}`;
        if (horizontal) {
          // The authored pivot is at the foot of the spine. After tipping onto
          // its cover, half the thickness raises that pivot onto the plank.
          book.setLocalEulerAngles(0, 0, 90);
          book.setLocalPosition((index < 3 ? -0.18 : 0.18) + height / 2, level.bottom + stackHeight + width / 2, -0.11 + depth / 2);
          stackHeight += width;
        } else {
          book.setLocalPosition(cursor + width / 2, level.bottom, -0.11 + depth / 2);
        }
        book.setLocalScale(width / 0.065, height / 0.26, depth / 0.20);
        for (const render of book.findComponents("render")) {
          for (const mesh of render.meshInstances) {
            if (mesh.material.name !== "Book leather") { continue; }
            let material = materials.get(color);
            if (!material) {
              material = mesh.material.clone();
              material.diffuseTint = true;
              material.diffuse.set(...this.colors[color]);
              material.update();
              materials.set(color, material);
            }
            mesh.material = material;
          }
        }
        shelf.addChild(book);
        cursor += width + gap;
      }
    }
  }
}
