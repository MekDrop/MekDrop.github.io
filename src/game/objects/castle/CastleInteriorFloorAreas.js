/**
 * Derives missing first-floor spaces from the built shell, including side rooms
 * omitted by the work-room bounds. Courtyard turf remains an outdoor area.
 * @param {import("../../generator/castle/CastleBuildPlanWriter.js").CastleBuildPlan} plan
 * @param {import("./CastleResidentialLayout.js").CastleResidentialLayout} layout
 */
export function createCastleInteriorFloorAreas(plan, layout) {
  if (!plan.metadata.runtime?.residential || !plan.metadata.collision?.cameraBlocks?.length) return [];
  const size = plan.metadata.collision?.blockSize ?? 0.25;
  const position = plan.input.position;
  const cols = Math.round(position.width / size), rows = Math.round(position.depth / size);
  const occupied = new Set(), covered = new Set();
  const floor = layout.origin.y;
  const ceiling = floor + plan.metadata.runtime.residential.floorHeight;
  for (const block of plan.metadata.collision?.cameraBlocks ?? []) {
    const ground = block.y - block.halfY < floor + 0.4 && block.y + block.halfY > floor + 0.4;
    const roof = block.y + block.halfY > ceiling - 0.5 && block.y - block.halfY < ceiling + 0.25;
    if (!ground && !roof) continue;
    for (let row = Math.max(0, Math.floor((block.z - block.halfZ - position.z) / size + 0.000001)); row < Math.min(rows, Math.ceil((block.z + block.halfZ - position.z) / size - 0.000001)); row += 1) {
      for (let col = Math.max(0, Math.floor((block.x - block.halfX - position.x) / size + 0.000001)); col < Math.min(cols, Math.ceil((block.x + block.halfX - position.x) / size - 0.000001)); col += 1) {
        const key = `${col},${row}`;
        if (ground) occupied.add(key);
        if (roof) covered.add(key);
      }
    }
  }
  const existing = [layout.rooms.work, ...layout.walkableAreas.filter(/**
   *
   * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
   */
  (area) => Math.abs(area.floorY - floor) < 0.01)];
  const rectangles = [];
  const active = new Map();
  for (let row = 1; row < rows - 1; row += 1) {
    const spans = [];
    let start = null;
    for (let col = 1; col <= cols - 1; col += 1) {
      const key = `${col},${row}`;
      const point = layout.toLocal(position.x + (col + 0.5) * size, position.z + (row + 0.5) * size);
      const omitted = existing.some(/**
       *
       * @param {{floorY:number,minX:number,maxX:number,minZ:number,maxZ:number}} area
       */
      (area) => point.x > area.minX - 0.000001 && point.x < area.maxX + 0.000001 && point.z > area.minZ - 0.000001 && point.z < area.maxZ + 0.000001);
      const valid = col < cols - 1 && covered.has(key) && !occupied.has(key) && !omitted;
      if (valid && start === null) start = col;
      if (!valid && start !== null) { spans.push([start, col]); start = null; }
    }
    const next = new Map();
    for (const [startCol, endCol] of spans) {
      const key = `${startCol},${endCol}`;
      const rectangle = active.get(key) ?? { startCol, endCol, startRow: row, endRow: row };
      rectangle.endRow = row + 1;
      if (!active.has(key)) rectangles.push(rectangle);
      next.set(key, rectangle);
    }
    active.clear();
    for (const [key, rectangle] of next) active.set(key, rectangle);
  }
  return rectangles.map(/**
   *
   * @param {{startCol:number,endCol:number,startRow:number,endRow:number}} rectangle
   * @param {number} index
   */
  (rectangle, index) => {
    const a = layout.toLocal(position.x + rectangle.startCol * size, position.z + rectangle.startRow * size);
    const b = layout.toLocal(position.x + rectangle.endCol * size, position.z + rectangle.endRow * size);
    return { id: `interiorFloor:${index}`, minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
      minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), floorY: floor };
  });
}
