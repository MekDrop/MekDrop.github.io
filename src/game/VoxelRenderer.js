import { Container, Graphics } from 'pixi.js';
import { TileType } from './MapGenerator.js';

const PALETTE = {
  [TileType.WATER]:        { top: 0x1d5f96, left: 0x0b2547,  right: 0x12345d,  stroke: 0x08203c },
  [TileType.GRASS]:        { top: 0x3f8f34, left: 0x6f4320,  right: 0x915629,  stroke: 0x2c2417 },
  [TileType.PATH]:         { top: 0xcaa46b, left: 0x76502a,  right: 0x9a6837,  stroke: 0x5a3a1e },
  [TileType.CASTLE_WALL]:  { top: 0x9a968b, left: 0x5c574f,  right: 0x716c61,  stroke: 0x3d3a35 },
  [TileType.CASTLE_TOWER]: { top: 0x7f7b73, left: 0x46423d,  right: 0x5a554d,  stroke: 0x302d2a },
  [TileType.ENTRY]:        { top: 0xb3483f, left: 0x6d2c27,  right: 0x8b3830,  stroke: 0x4d1f1b },
};

const FIXED_HEIGHTS = {
  [TileType.WATER]:        0,
  [TileType.CASTLE_WALL]:  7,
  [TileType.CASTLE_TOWER]: 9,
};

const MAX_BLOCK_H = 12;
const BRIDGE_DECK_DEPTH = 0.28;
const PATH_COLORS = [0xff2222, 0x2299ff, 0xffee00, 0x22ee55, 0xff44dd];

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function shadeColor(color, amount) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const target = amount >= 0 ? 255 : 0;
  const weight = Math.abs(amount);

  return (clampByte(r + (target - r) * weight) << 16) |
         (clampByte(g + (target - g) * weight) << 8) |
          clampByte(b + (target - b) * weight);
}

function tileNoise(col, row) {
  let n = (col * 374761393 + row * 668265263) ^ ((col + row) * 2246822519);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}

export class VoxelRenderer {
  #mapData = null;
  #arrowsVisible = false;
  #zoom = 1.0;
  #containerX = 0;
  #containerY = 0;

  constructor(app) {
    this.app = app;
    this.container = new Container();
    app.stage.addChild(this.container);
  }

  render(mapData) {
    this.#mapData = mapData;
    this.#zoom = 1.0;
    this.#containerX = 0;
    this.#containerY = 0;
    this.#redraw();
  }

  setArrowsVisible(visible) {
    this.#arrowsVisible = visible;
    this.#redraw();
  }

  getArrowsVisible() {
    return this.#arrowsVisible;
  }

  getZoom() {
    return this.#zoom;
  }

  getViewport() {
    return {
      zoom: this.#zoom,
      x: this.#containerX,
      y: this.#containerY,
    };
  }

  setViewport({ zoom, x, y }) {
    this.#zoom = zoom;
    this.#containerX = x;
    this.#containerY = y;
    this.container.scale.set(this.#zoom);
    this.container.position.set(this.#containerX, this.#containerY);
  }

  zoomTo(newZoom, pivotX, pivotY) {
    const localX = (pivotX - this.#containerX) / this.#zoom;
    const localY = (pivotY - this.#containerY) / this.#zoom;
    this.#zoom = newZoom;
    this.#containerX = pivotX - localX * newZoom;
    this.#containerY = pivotY - localY * newZoom;
    this.container.scale.set(this.#zoom);
    this.container.position.set(this.#containerX, this.#containerY);
  }

  #redraw() {
    this.container.removeChildren();
    if (!this.#mapData) return;

    const { grid, cols, rows, arrowData } = this.#mapData;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;

    this.hw = 12;
    this.hh = 6;
    this.bh = this.hh * 2;

    const span = cols + rows - 2;
    this.originX = sw / 2 - ((cols - rows) / 2) * this.hw;
    const visH = MAX_BLOCK_H * this.bh + span * this.hh + this.hh;
    this.originY = (sh - visH) / 2 + MAX_BLOCK_H * this.bh;

    const tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push({ col: c, row: r, type: grid[r][c], depth: c + r });
      }
    }
    tiles.sort((a, b) => a.depth - b.depth || a.col - b.col);

    const g = new Graphics();
    for (const { col, row, type } of tiles) {
      if (this.#tileRenderMode(col, row) === 'BRIDGE') {
        this.#drawTopDiamond(g, col, row, this.#tilePalette(TileType.WATER, col, row).top, null);
        this.#drawBridgeVoxel(g, col, row, this.#tileTopProfile(col, row), this.#tilePalette(type, col, row));
        continue;
      }
      this.#drawVoxel(g, col, row, this.#tileTopHeight(col, row), this.#tilePalette(type, col, row));
    }
    this.container.addChild(g);

    if (this.#arrowsVisible && arrowData) {
      const ag = new Graphics();
      for (const { col, row } of tiles) {
        const info = arrowData.get(`${col},${row}`);
        if (info) this.#drawInpaintedArrows(ag, col, row, info);
      }
      this.container.addChild(ag);
    }

    this.container.scale.set(this.#zoom);
    this.container.position.set(this.#containerX, this.#containerY);
  }

  #toScreen(col, row) {
    return {
      x: (col - row) * this.hw + this.originX,
      y: (col + row) * this.hh + this.originY,
    };
  }

  #tileBaseHeight(col, row) {
    const { grid, heightmap } = this.#mapData;
    const type = grid[row][col];
    if (type in FIXED_HEIGHTS) return FIXED_HEIGHTS[type];
    return heightmap[row][col];
  }

  #tileTopHeight(col, row) {
    return this.#tileBaseHeight(col, row);
  }

  #tileTopProfile(col, row) {
    const center = this.#tileTopHeight(col, row);
    return { nw: center, ne: center, se: center, sw: center, center };
  }

  #occlusionNeighborProfile(col, row) {
    if (!this.#mapData || col < 0 || row < 0 || col >= this.#mapData.cols || row >= this.#mapData.rows) {
      return { nw: 0, ne: 0, se: 0, sw: 0, center: 0 };
    }
    if (this.#tileRenderMode(col, row) === 'BRIDGE') {
      return { nw: 0, ne: 0, se: 0, sw: 0, center: 0 };
    }
    return this.#tileTopProfile(col, row);
  }

  #tileRenderMode(col, row) {
    return this.#mapData?.tileMeta?.[row]?.[col]?.renderMode ?? 'SOLID';
  }

  #tilePalette(type, col, row) {
    const base = PALETTE[type];
    const n = tileNoise(col, row);
    if (type === TileType.GRASS) {
      const amount = -0.1 + n * 0.18;
      return {
        ...base,
        top: shadeColor(base.top, amount),
        left: shadeColor(base.left, -0.04 + n * 0.06),
        right: shadeColor(base.right, -0.03 + n * 0.05),
      };
    }

    if (type === TileType.PATH || type === TileType.ENTRY) {
      return { ...base, top: shadeColor(base.top, -0.06 + n * 0.08) };
    }

    if (type === TileType.WATER) {
      return { ...base, top: shadeColor(base.top, -0.08 + n * 0.12) };
    }

    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      return { ...base, top: shadeColor(base.top, -0.05 + n * 0.08) };
    }

    return base;
  }

  #drawVoxel(g, col, row, blockUnits, pal) {
    const { x: sx, y: sy } = this.#toScreen(col, row);
    const hw = this.hw;
    const hh = this.hh;
    const profile = this.#tileTopProfile(col, row);

    if (blockUnits === 0) {
      this.#drawTopDiamond(g, col, row, pal.top, pal.stroke);
      return;
    }

    const { cols, rows } = this.#mapData;
    const right = (col + 1 < cols)
      ? this.#occlusionNeighborProfile(col + 1, row)
      : { nw: 0, ne: 0, se: 0, sw: 0, center: 0 };
    const left = (row + 1 < rows)
      ? this.#occlusionNeighborProfile(col, row + 1)
      : { nw: 0, ne: 0, se: 0, sw: 0, center: 0 };

    if (right.nw < profile.ne || right.sw < profile.se) {
      const rightPts = [
        sx + hw, sy - profile.ne * this.bh,
        sx,      sy + hh - profile.se * this.bh,
        sx,      sy + hh - right.sw * this.bh,
        sx + hw, sy - right.nw * this.bh,
      ];
      this.#poly(g, rightPts, pal.right, null);
      this.#strokeLine(g, sx + hw, sy - profile.ne * this.bh, sx, sy + hh - profile.se * this.bh, pal.stroke, 0.8, 0.88);
      this.#strokeLine(g, sx + hw, sy - profile.ne * this.bh, sx + hw, sy - right.nw * this.bh, pal.stroke, 0.8, 0.88);
    }

    if (left.nw < profile.sw || left.ne < profile.se) {
      const leftPts = [
        sx - hw, sy - profile.sw * this.bh,
        sx,      sy + hh - profile.se * this.bh,
        sx,      sy + hh - left.ne * this.bh,
        sx - hw, sy - left.nw * this.bh,
      ];
      this.#poly(g, leftPts, pal.left, null);
      this.#strokeLine(g, sx - hw, sy - profile.sw * this.bh, sx, sy + hh - profile.se * this.bh, pal.stroke, 0.8, 0.88);
      this.#strokeLine(g, sx - hw, sy - profile.sw * this.bh, sx - hw, sy - left.nw * this.bh, pal.stroke, 0.8, 0.88);
    }

    const topPts = [
      sx,      sy - hh - profile.nw * this.bh,
      sx + hw, sy - profile.ne * this.bh,
      sx,      sy + hh - profile.se * this.bh,
      sx - hw, sy - profile.sw * this.bh,
    ];
    this.#poly(g, topPts, pal.top, pal.stroke);
  }

  #drawTopDiamond(g, col, row, fillColor, strokeColor = null) {
    const { x: sx, y: sy } = this.#toScreen(col, row);
    const topPts = [sx, sy - this.hh, sx + this.hw, sy, sx, sy + this.hh, sx - this.hw, sy];
    this.#poly(g, topPts, fillColor, strokeColor);
  }

  #drawBridgeVoxel(g, col, row, profile, pal) {
    const { x: sx, y: sy } = this.#toScreen(col, row);
    const hw = this.hw;
    const hh = this.hh;
    const deckThickness = this.bh * BRIDGE_DECK_DEPTH;
    const underside = {
      nw: profile.nw - BRIDGE_DECK_DEPTH,
      ne: profile.ne - BRIDGE_DECK_DEPTH,
      se: profile.se - BRIDGE_DECK_DEPTH,
      sw: profile.sw - BRIDGE_DECK_DEPTH,
    };
    const bridgeLeft = shadeColor(pal.left, -0.14);
    const bridgeRight = shadeColor(pal.right, -0.14);

    const rightPts = [
      sx + hw, sy - profile.ne * this.bh,
      sx,      sy + hh - profile.se * this.bh,
      sx,      sy + hh - underside.se * this.bh,
      sx + hw, sy - underside.ne * this.bh,
    ];
    this.#poly(g, rightPts, bridgeRight, null);

    const leftPts = [
      sx - hw, sy - profile.sw * this.bh,
      sx,      sy + hh - profile.se * this.bh,
      sx,      sy + hh - underside.se * this.bh,
      sx - hw, sy - underside.sw * this.bh,
    ];
    this.#poly(g, leftPts, bridgeLeft, null);

    const topPts = [
      sx,      sy - hh - profile.nw * this.bh,
      sx + hw, sy - profile.ne * this.bh,
      sx,      sy + hh - profile.se * this.bh,
      sx - hw, sy - profile.sw * this.bh,
    ];
    this.#poly(g, topPts, pal.top, pal.stroke);

    this.#strokeLine(g, sx + hw, sy - profile.ne * this.bh, sx, sy + hh - profile.se * this.bh, pal.stroke, 0.8, 0.88);
    this.#strokeLine(g, sx - hw, sy - profile.sw * this.bh, sx, sy + hh - profile.se * this.bh, pal.stroke, 0.8, 0.88);
  }

  #drawInpaintedArrows(g, col, row, arrowList) {
    const { x: sx, y: sy } = this.#toScreen(col, row);
    const hw = this.hw;
    const hh = this.hh;
    const bh = this.#tileTopProfile(col, row).center * this.bh;

    const cx = sx;
    const cy = sy - bh;

    const shaftBack = hw * 0.28;
    const shaftTip = hw * 0.08;
    const headFwd = hw * 0.34;
    const headBack = hw * 0.06;
    const headSide = hh * 0.4;

    const count = arrowList.length;
    const spacing = hh * 0.72;

    for (let j = 0; j < count; j++) {
      const { dc, dr, sideDc = 0, sideDr = 0, marker = 'arrow', pathIdx } = arrowList[j];
      const scale = count > 1 ? 0.78 : 1;

      const ddx = (dc - dr) * hw;
      const ddy = (dc + dr) * hh;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      if (len === 0) continue;
      const nx = ddx / len;
      const ny = ddy / len;
      const px = -ny;
      const py = nx;
      const sideX = (sideDc - sideDr) * hw * 0.5;
      const sideY = (sideDc + sideDr) * hh * 0.5;

      const offset = (j - (count - 1) / 2) * spacing;
      const acx = cx + sideX + px * offset;
      const acy = cy + sideY + py * offset;

      const color = PATH_COLORS[pathIdx % PATH_COLORS.length];
      if (marker === 'dot') {
        g.circle(acx, acy, hh * 0.24 * scale);
        g.fill({ color, alpha: 0.62 });
        g.stroke({ color: 0x5a3a1e, width: 0.45, alpha: 0.35 });
        continue;
      }

      const tipX = acx + nx * headFwd * scale;
      const tipY = acy + ny * headFwd * scale;
      const headLeftX = acx - nx * headBack * scale + px * headSide * scale;
      const headLeftY = acy - ny * headBack * scale + py * headSide * scale;
      const headRightX = acx - nx * headBack * scale - px * headSide * scale;
      const headRightY = acy - ny * headBack * scale - py * headSide * scale;
      const tailX = acx - nx * shaftBack * scale;
      const tailY = acy - ny * shaftBack * scale;
      const stemX = acx + nx * shaftTip * scale;
      const stemY = acy + ny * shaftTip * scale;

      g.moveTo(headLeftX, headLeftY);
      g.lineTo(tipX, tipY);
      g.lineTo(headRightX, headRightY);
      g.stroke({ color: 0x5a3a1e, width: 2.8 * scale, alpha: 0.42, cap: 'round', join: 'round' });

      g.moveTo(headLeftX, headLeftY);
      g.lineTo(tipX, tipY);
      g.lineTo(headRightX, headRightY);
      g.stroke({ color, width: 1.65 * scale, alpha: 0.78, cap: 'round', join: 'round' });

      g.moveTo(tailX, tailY);
      g.lineTo(stemX, stemY);
      g.stroke({ color: 0x5a3a1e, width: 2.1 * scale, alpha: 0.34, cap: 'round' });

      g.moveTo(tailX, tailY);
      g.lineTo(stemX, stemY);
      g.stroke({ color, width: 1.05 * scale, alpha: 0.7, cap: 'round' });
    }
  }

  #strokeLine(g, x1, y1, x2, y2, color, width = 0.8, alpha = 0.9) {
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke({ color, width, alpha, cap: 'round', join: 'round' });
  }

  #poly(g, pts, fillColor, strokeColor = null) {
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill({ color: fillColor });
    if (strokeColor !== null) {
      g.stroke({ color: strokeColor, width: 0.8 });
    }
  }
}
