// A continuous spillway, thinning curtain, and open tail. Vertex colors encode
// front/rear depth, falling progress, lip progress, and tail opacity. The flow
// metadata magnitude carries the across-curtain coordinate for every shader pass.
const BANK_SEAM_OVERLAP = 0.012;

export class WaterfallGeometry {
  #waterfall;
  #direction;
  #center;
  #terminal;
  #routeDistance;
  #join;

  constructor(
    waterfall,
    direction,
    cols,
    rows,
    terminal,
    routeDistance,
    join = null,
  ) {
    this.#waterfall = waterfall;
    this.#direction = direction;
    this.#center = [
      waterfall.col - (cols - 1) / 2,
      waterfall.row - (rows - 1) / 2,
    ];
    this.#terminal = terminal;
    this.#routeDistance = routeDistance;
    this.#join = join;
  }

  append(grid, section = "all") {
    const lipRows = 12;
    const width = 12;
    const drop = this.#waterfall.topElevation - this.#waterfall.bottomElevation;
    const taperStrength = Math.min(1, Math.max(0, (drop - 4) / 2)) * 0.18;
    const fallRows = Math.max(12, Math.ceil(drop * 5));
    const rows = lipRows + fallRows;
    const fadeStartRow = lipRows + Math.floor(fallRows * 0.78);
    const startRow = section === "tail" ? fadeStartRow : 0;
    const endRow = section === "body" ? fadeStartRow : rows;
    const sectionRows = endRow - startRow;
    const radius = Math.min(0.22, drop * 0.22);
    const direction = this.#direction;
    const cross = { col: -direction.row, row: direction.col };
    const pointAt = (row, column, rear = false) => {
      if (row === 0 && this.#join) {
        return (rear ? this.#join.rear : this.#join.front)[column];
      }
      const across = column / width - 0.5;
      const lip = Math.min(1, row / lipRows);
      const edgeSide = column === 0 ? -1 : column === width ? 1 : 0;
      // Row zero is the river's downstream edge, so it remains exact and can
      // reuse those vertices. The hidden bank overlap begins inside the curve.
      const bankJoin = BANK_SEAM_OVERLAP * Math.sin(lip * Math.PI);
      const joinedAcross = across + edgeSide * bankJoin;
      const fall = Math.max(0, (row - lipRows) / fallRows);
      const angle = lip * Math.PI / 2;
      const arc = Math.sin(angle);
      // Short cascades keep their full width; only drops over four cubes narrow.
      const taper = 1 - taperStrength * Math.sin(fall * Math.PI * 0.85);
      const scallop =
        Math.sin(across * 19 + 0.7) * 0.5 + Math.sin(across * 31) * 0.25;
      const bottom =
        this.#waterfall.bottomElevation + 0.012 +
        (this.#terminal ? 0.18 + scallop * 0.22 : -0.06);
      const belly = Math.sin((across + 0.5) * Math.PI) * 0.025 * arc;
      const drift = fall * fall * (this.#terminal ? 0.12 : 0.04);
      // Bury only the two lip-edge columns just inside the lateral banks. The
      // overlap closes fractional-zoom raster cracks without changing draw order.
      const forward =
        0.5 - Math.abs(edgeSide) * bankJoin + radius * arc + belly + drift;
      const top = this.#waterfall.topElevation + 0.012;
      const boundaryHeight = this.#join?.front[column]?.[1] ?? top;
      const y = top - radius * (1 - Math.cos(angle)) +
        (boundaryHeight - top) * (1 - lip);
      const frontHeight = y + (bottom - (top - radius)) * fall;
      // The rear leaves the riverbed and descends. Rotating a half-cell depth
      // around the front arc made this surface climb upward into a folded lip.
      const rearStart = this.#join?.rear[column]?.[1] ?? top - 0.5;
      const rearLip = rearStart - 0.04 * (1 - Math.cos(angle));
      // Let the back meet the falling front as soon as it clears the riverbed.
      // Spreading that height difference over the whole fall creates a broad,
      // flat side panel even though the horizontal sheet thickness is small.
      const rearHeight = Math.min(rearLip, frontHeight - 0.025);
      const thickness = 0.055 * arc * (1 - fall * 0.25);
      const surfaceForward = forward - (rear ? thickness : 0);
      return [
        this.#center[0] +
          direction.col * surfaceForward +
          cross.col * joinedAcross * taper,
        rear ? rearHeight : frontHeight,
        this.#center[1] +
          direction.row * surfaceForward +
          cross.row * joinedAcross * taper,
      ];
    };
    const colorAt = (row, rear = false) => {
      const fall = Math.max(0, (row - lipRows) / fallRows);
      const fade = this.#terminal ? Math.max(0, (fall - 0.78) / 0.22) : 0;
      return [
        rear ? 255 : 0,
        Math.round(fall * 255),
        Math.round(Math.min(1, row / lipRows) * 255),
        Math.round((1 - fade * fade * (3 - 2 * fade)) * 255),
      ];
    };
    const uvAt = (row, column) => {
      if (row === 0 && this.#join) {
        return this.#join.uvs[column];
      }
      return [
        column / width,
        this.#routeDistance + Math.min(1, row / lipRows) * radius * Math.PI / 2 +
          Math.max(0, (row - lipRows) / fallRows) * (drop - radius),
      ];
    };
    // Carry the source pressure across the exact lip vertices, then let it
    // dissipate down the rounded spillway. Fall/depth color metadata stays intact.
    const sourceAt = (row, column, rear = false) => {
      const source = this.#join?.sources?.[column];
      if (!source || rear) {
        return [0, 0];
      }
      const progress = Math.min(1, row / lipRows);
      const fade = 1 - progress * progress * (3 - 2 * progress);
      return [source[0] * fade, source[1]];
    };
    const metadataAt = (column) => {
      const magnitude = 2 + column / width;
      return [direction.col * magnitude, direction.row * magnitude];
    };
    grid(
      sectionRows, width, (r, c) => pointAt(r + startRow, c),
      [direction.col, 0, direction.row],
      (r) => colorAt(r + startRow), false, false,
      (r, c) => uvAt(r + startRow, c),
      (r, c) => metadataAt(c),
      (r, c) => sourceAt(r + startRow, c),
    );
    grid(
      sectionRows, width, (r, c) => pointAt(r + startRow, c, true),
      [-direction.col, 0, -direction.row],
      (r) => colorAt(r + startRow, true), true, false,
      (r, c) => uvAt(r + startRow, c),
      (r, c) => metadataAt(c),
    );
    // Side faces share exactly the front/back boundary positions; no extra shells.
    for (const column of [0, width]) {
      const side = column === 0 ? -1 : 1;
      grid(
        sectionRows, 1,
        (r, c) => pointAt(r + startRow, column, c === 1),
        [cross.col * side, 0, cross.row * side],
        (r, c) => colorAt(r + startRow, c === 1), column === 0, false,
        (r) => uvAt(r + startRow, column),
        () => metadataAt(column),
        (r, c) => sourceAt(r + startRow, column, c === 1),
      );
    }
  }
}
