import { Container, Graphics } from 'pixi.js';
import { TileType } from './MapGenerator.js';

const PALETTE = {
  [TileType.WATER]:        { top: 0x1a3a6a, left: 0x0f2040, right: 0x152850, stroke: 0x0a1530 },
  [TileType.GRASS]:        { top: 0x5cb85c, left: 0x3a7a3a, right: 0x48a048, stroke: 0x2a5a2a },
  [TileType.PATH]:         { top: 0xd4aa6a, left: 0x8a6030, right: 0xa87840, stroke: 0x6a4020 },
  [TileType.CASTLE_WALL]:  { top: 0xa0a0b8, left: 0x606078, right: 0x787890, stroke: 0x404055 },
  [TileType.CASTLE_TOWER]: { top: 0x8888b8, left: 0x484868, right: 0x606080, stroke: 0x303050 },
  [TileType.ENTRY]:        { top: 0x20c820, left: 0x107010, right: 0x189018, stroke: 0x085008 },
};

const HEIGHTS = {
  [TileType.WATER]:        0,
  [TileType.GRASS]:        1,
  [TileType.PATH]:         1,
  [TileType.CASTLE_WALL]:  3,
  [TileType.CASTLE_TOWER]: 5,
  [TileType.ENTRY]:        2,
};

const MAX_BLOCK_H = 5;

// One distinct colour per path
const PATH_COLORS = [0xff2222, 0x2299ff, 0xffee00, 0x22ee55, 0xff44dd];

export class VoxelRenderer {
  constructor(app) {
    this.app = app;
    this.container = new Container();
    app.stage.addChild(this.container);
    this._mapData = null;
    this._arrowsVisible = false;
  }

  render(mapData) {
    this._mapData = mapData;
    this._redraw();
  }

  setArrowsVisible(visible) {
    this._arrowsVisible = visible;
    this._redraw();
  }

  _redraw() {
    this.container.removeChildren();
    if (!this._mapData) return;

    const { grid, cols, rows, arrowData } = this._mapData;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;

    const rawHw = 24, rawHh = 12, rawBh = 10;
    const span = cols + rows - 2;
    const s = Math.min((sw * 0.90) / (span * rawHw), (sh * 0.88) / (span * rawHh + MAX_BLOCK_H * rawBh), 1.0);
    this.hw = rawHw * s;
    this.hh = rawHh * s;
    this.bh = rawBh * s;

    // Centre the diamond in the canvas
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
      this._drawVoxel(g, col, row, HEIGHTS[type], PALETTE[type]);

      // Inpaint arrows directly onto the tile top face — same render pass, correct depth
      if (this._arrowsVisible && arrowData) {
        const info = arrowData.get(`${col},${row}`);
        if (info) this._drawInpaintedArrows(g, col, row, info);
      }
    }
    this.container.addChild(g);
  }

  _toScreen(col, row) {
    return {
      x: (col - row) * this.hw + this.originX,
      y: (col + row) * this.hh + this.originY,
    };
  }

  _drawVoxel(g, col, row, blockUnits, pal) {
    const { x: sx, y: sy } = this._toScreen(col, row);
    const hw = this.hw, hh = this.hh;
    const bh = blockUnits * this.bh;

    if (blockUnits === 0) {
      this._poly(g, [sx, sy - hh, sx + hw, sy, sx, sy + hh, sx - hw, sy], pal.top, pal.stroke);
      return;
    }

    this._poly(g, [
      sx + hw, sy - bh,
      sx,      sy + hh - bh,
      sx,      sy + hh,
      sx + hw, sy,
    ], pal.right, pal.stroke);

    this._poly(g, [
      sx - hw, sy - bh,
      sx,      sy + hh - bh,
      sx,      sy + hh,
      sx - hw, sy,
    ], pal.left, pal.stroke);

    this._poly(g, [
      sx,      sy - hh - bh,
      sx + hw, sy - bh,
      sx,      sy + hh - bh,
      sx - hw, sy - bh,
    ], pal.top, pal.stroke);
  }

  // Arrows painted flat onto the tile top face — same z-plane, looks like road markings.
  // arrowList = [{dc, dr, pathIdx}, ...] — each entry has its own direction.
  _drawInpaintedArrows(g, col, row, arrowList) {
    const { x: sx, y: sy } = this._toScreen(col, row);
    const hw = this.hw, hh = this.hh;
    const blockUnits = this._mapData.grid[row][col] === TileType.ENTRY ? 2 : 1;
    const bh = blockUnits * this.bh;

    // Geometric centre of the top face diamond
    const cx = sx;
    const cy = sy - bh;

    const arrowHalf = Math.min(hw * 0.38, hh * 0.82);
    const headLen   = arrowHalf * 0.40;
    const shaftW    = Math.max(arrowHalf * 0.14, 0.9);
    const headW     = arrowHalf * 0.30;
    const spacing   = shaftW * 3.0;

    const N = arrowList.length;

    for (let j = 0; j < N; j++) {
      const { dc, dr, pathIdx } = arrowList[j];

      // Screen direction for this specific path's movement at this tile
      const ddx = (dc - dr) * hw;
      const ddy = (dc + dr) * hh;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      if (len === 0) continue;
      const nx = ddx / len, ny = ddy / len;
      const px = -ny, py = nx; // perpendicular

      // Side-by-side offset along the perpendicular when multiple arrows share a tile
      const offset = (j - (N - 1) / 2) * spacing;
      const acx = cx + px * offset;
      const acy = cy + py * offset;

      const bx = acx - nx * arrowHalf, by = acy - ny * arrowHalf;
      const mx = acx + nx * (arrowHalf - headLen), my = acy + ny * (arrowHalf - headLen);
      const tx = acx + nx * arrowHalf, ty = acy + ny * arrowHalf;

      const pts = [
        bx + px * shaftW, by + py * shaftW,
        mx + px * shaftW, my + py * shaftW,
        mx + px * headW,  my + py * headW,
        tx, ty,
        mx - px * headW,  my - py * headW,
        mx - px * shaftW, my - py * shaftW,
        bx - px * shaftW, by - py * shaftW,
      ];

      const color = PATH_COLORS[pathIdx % PATH_COLORS.length];
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.closePath();
      g.fill({ color, alpha: 0.82 });
      g.stroke({ color: 0x111111, width: 0.6, alpha: 0.7 });
    }
  }

  _poly(g, pts, fillColor, strokeColor) {
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill({ color: fillColor });
    g.stroke({ color: strokeColor, width: 0.8 });
  }
}
