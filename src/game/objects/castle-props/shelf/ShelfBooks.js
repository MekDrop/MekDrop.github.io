import { BookCover } from "../book/BookCover.js";

/**
 * Packs individual Book definitions; older composite residences reuse the same layout.
 */
export class ShelfBooks {
  /**
   * Shelf plank tops and clearance below the next plank, measured from bookcase.glb.
   * @type {{bottom:number,height:number}[]}
   */
  static levels = [{
    bottom: 0.08,
    height: 0.29,
  }, {
    bottom: 0.42,
    height: 0.31,
  },
  {
    bottom: 0.78,
    height: 0.30,
  }, {
    bottom: 1.13,
    height: 0.145,
  }];
  /**
   * @type {number[][]}
   */
  static colors = [[0.65, 0.22, 0.22], [0.20, 0.38, 0.62], [0.27, 0.48, 0.30],
    [0.62, 0.43, 0.22], [0.45, 0.28, 0.52], [0.33, 0.24, 0.19]];

  /**
   * @param {import("../../../models/GameModelLibrary.js").GameModelLibrary} models
   * @param {import("playcanvas").Entity} shelf
   * @param {string} bookUrl
   * @param {() => number} random
   * @param {{bottom:number,height:number}[]} [levels]
   */
  static populate(
    models,
    shelf,
    bookUrl,
    random = Math.random,
    levels = this.levels,
  ) {
    for (const node of shelf.find(ShelfBooks.#findNode)) {
      node.destroy();
    }
    const materials = new Map();
    shelf.once("destroy", () => {
      for (const material of materials.values()) {
        material.destroy();
      }
    });
    for (const definition of this.layout(random, levels)) {
      const book = models.instantiate(bookUrl);
      book.name = definition.id;
      const { position, stretch, tilt } = definition;
      book.setLocalPosition(position.x, position.y, position.z);
      book.setLocalScale(stretch.x, stretch.y, stretch.z);
      book.setLocalEulerAngles(0, 0, tilt.z);
      BookCover.tint(book, definition.coverColor, /**
       *
       * @param {import("playcanvas").StandardMaterial} material
       */
        material => {
          const key = definition.coverColor.join(",");
          if (!materials.has(key)) {
            materials.set(key, material.clone());
          }
          return materials.get(key);
        });
      shelf.addChild(book);
    }
  }

  /**
   * Individual placements in the cabinet's authored local coordinates.
   * @param {() => number} [random]
   * @param {{bottom:number,height:number}[]} [levels]
   * @returns {import("../../ObjectTypes.js").MapObjectDefinition[]}
   */
  static layout(random = Math.random, levels = this.levels) {
    const books = [];
    for (const [row, level] of levels.entries()) {
      const horizontal = level.height < 0.24;
      const count = horizontal ? 6 : 10;
      const widths = Array.from({ length: count }, () => horizontal ? 0.032 + random() * 0.008 : 0.04 + random() * 0.025);
      const total = widths.reduce(ShelfBooks.#reduceSum, 0);
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
        const book = {
          id: `book-${row}-${index}`,
          object: "Book",
          isOpen: false,
          pose: "upright",
          coverColor: this.colors[color],
          tilt: {
            x: 0,
            z: 0,
          },
        };
        if (horizontal) {
          // The authored pivot is at the foot of the spine. After tipping onto
          // its cover, half the thickness raises that pivot onto the plank.
          book.tilt.z = 90;
          book.position = {
            x: (index < 3 ? -0.18 : 0.18) + height / 2,
            y: level.bottom + stackHeight + width / 2,
            z: -0.11 + depth / 2,
          };
          stackHeight += width;
        } else {
          book.position = {
            x: cursor + width / 2,
            y: level.bottom,
            z: -0.11 + depth / 2,
          };
        }
        book.stretch = {
          x: width / 0.065,
          y: height / 0.26,
          z: depth / 0.20,
        };
        books.push(book);
        cursor += width + gap;
      }
    }

    return books;
  }

  /**
   *
   * @param {import("playcanvas").GraphNode} node
   */
  static #findNode(node) {
    return /^(Leather bound book|Book spine brass)/.test(node.name);
  }

  /**
   * @param {number} sum
   * @param {number} width
   */
  static #reduceSum(sum, width) {
    return sum + width;
  }
}
