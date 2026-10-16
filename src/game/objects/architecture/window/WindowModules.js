/**
 * Repeats the imported window kit inside its normalized aperture.
 */
export class WindowModules {
  /**
   * @param {import("playcanvas").Entity} visual
   * @param {{width:number,height:number,role:string}} window
   */
  static fit(visual, window) {
    const panes = visual.find(WindowModules.#findNode);
    if (!panes.length) {
      return;
    }
    const sourceColumns = new Set(panes.map(WindowModules.#mapNode)).size;
    const sourceRows = panes.length / sourceColumns;
    const columns = window.role === "slit" ? sourceColumns : Math.max(sourceColumns, Math.ceil(window.width / 0.5));
    const rows = Math.max(sourceRows, Math.ceil(window.height / 0.5));
    const pane = panes[0];
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const copy = pane.clone();
        copy.name = `Amber glass pane ${column} ${row}`;
        // Seat the glazing inside the timber depth. The imported panes sit
        // behind the dividers, exposing a slit when viewed obliquely.
        copy.setLocalPosition(-0.5 + (column + 0.5) / columns,
          (row + 0.5) / rows, pane.getLocalPosition().z + 0.035);
        const scale = pane.getLocalScale();
        copy.setLocalScale(scale.x * sourceColumns / columns, scale.y * sourceRows / rows, scale.z);
        pane.parent.addChild(copy);
      }
    }
    for (const node of panes) { node.destroy(); }
    this.#repeat(visual, /^Fine oak transom /, rows - 1, "y", rows);
    this.#repeat(visual, /^Central oak mullion/, columns - 1, "x", columns);
    for (const side of [1, -1]) {
      const courses = visual.find(/**
       *
       * @param {import("playcanvas").GraphNode} node
       */
        (node) => node.name.startsWith(`Stone jamb course ${side} `));
      if (!courses.length) { continue; }
      const count = Math.max(courses.length, Math.ceil(window.height / 0.25));
      const template = courses[0];
      for (let index = 0; index < count; index++) {
        const copy = template.clone();
        copy.name = `Stone jamb course ${side} ${index}`;
        const position = template.getLocalPosition();
        copy.setLocalPosition(position.x, (index + 0.5) / count, position.z);
        const scale = template.getLocalScale();
        copy.setLocalScale(scale.x, scale.y * courses.length / count, scale.z);
        template.parent.addChild(copy);
      }
      for (const node of courses) { node.destroy(); }
    }
  }

  /**
   * @param {import("playcanvas").Entity} visual
   * @param {RegExp} pattern
   * @param {number} count
   * @param {"x"|"y"} axis
   * @param {number} divisions
   */
  static #repeat(visual, pattern, count, axis, divisions) {
    const nodes = visual.find(/**
     *
     * @param {import("playcanvas").GraphNode} node
     */
      (node) => pattern.test(node.name));
    if (!nodes.length) { return; }
    const template = nodes[0];
    for (let index = 1; index <= count; index++) {
      const copy = template.clone();
      copy.name = `${template.name} module ${index}`;
      const position = template.getLocalPosition().clone();
      position[axis] = index / divisions - (axis === "x" ? 0.5 : 0);
      copy.setLocalPosition(position);
      template.parent.addChild(copy);
    }
    for (const node of nodes) { node.destroy(); }
  }

  /**
   *
   * @param {import("playcanvas").GraphNode} node
   */
  static #findNode(node) {
    return /^Amber glass pane /.test(node.name);
  }

  /**
   *
   * @param {import("playcanvas").GraphNode} node
   */
  static #mapNode(node) {
    return node.name.split(" ")[3];
  }
}
