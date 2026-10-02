/**
 * Packs independently randomized book widths into each authored shelf section.
 */
export class BookshelfBooks {
  /**
   * @param {import("playcanvas").Entity} model
   * @param {() => number} random
   */
  static randomize(model, random = Math.random) {
    const books = model.find(/**
     *
     * @param {import("playcanvas").GraphNode} node
     */
    (node) => node.name.startsWith("Leather bound book"));
    const bands = model.find(/**
     *
     * @param {import("playcanvas").GraphNode} node
     */
    (node) => node.name.startsWith("Book spine brass"));
    const attachments = new Map(books.map(/**
     *
     * @param {import("playcanvas").GraphNode} book
     */
    (book) => [book, []]));
    for (const band of bands) {
      const position = band.getLocalPosition();
      const book = books.reduce(/**
       *
       * @param {import("playcanvas").GraphNode} nearest
       * @param {import("playcanvas").GraphNode} candidate
       */
      (nearest, candidate) => {
        const point = candidate.getLocalPosition();
        const other = nearest.getLocalPosition();
        const distance = Math.abs(point.x - position.x) * 10 + Math.abs(point.y - position.y);
        const previous = Math.abs(other.x - position.x) * 10 + Math.abs(other.y - position.y);
        return distance < previous ? candidate : nearest;
      }, books[0]);
      if (book) attachments.get(book).push(band);
    }
    const rows = new Map();
    for (const book of books) {
      const level = Math.round(book.getLocalPosition().y * 100);
      if (!rows.has(level)) rows.set(level, []);
      rows.get(level).push(book);
    }
    for (const row of rows.values()) {
      row.sort(/**
       *
       * @param {import("playcanvas").GraphNode} a
       * @param {import("playcanvas").GraphNode} b
       */
      (a, b) => a.getLocalPosition().x - b.getLocalPosition().x);
      const samples = row.map(() => 0.032 + random() * 0.085);
      const total = samples.reduce(/**
       *
       * @param {number} sum
       * @param {number} width
       */
      (sum, width) => sum + width, 0);
      // Leave room for all gaps and keep books inside the oak side panels.
      const factor = Math.min(1, 0.60 / total);
      const gap = 0.012;
      let cursor = -(total * factor + gap * (row.length - 1)) / 2;
      row.forEach(/**
       *
       * @param {import("playcanvas").GraphNode} book
       * @param {number} index
       */
      (book, index) => {
        const width = samples[index] * factor;
        const center = cursor + width / 2;
        const position = book.getLocalPosition().clone();
        const scale = book.getLocalScale().clone();
        // The authored book mesh is 0.065 wide before its node transform.
        const ratio = width / (0.065 * scale.x);
        for (const band of attachments.get(book)) {
          const bandPosition = band.getLocalPosition().clone();
          const bandScale = band.getLocalScale().clone();
          band.setLocalPosition(center + (bandPosition.x - position.x) * ratio, bandPosition.y, bandPosition.z);
          band.setLocalScale(bandScale.x * ratio, bandScale.y, bandScale.z);
        }
        book.setLocalPosition(center, position.y, position.z);
        book.setLocalScale(scale.x * ratio, scale.y, scale.z);
        cursor += width + gap;
      });
    }
  }
}
