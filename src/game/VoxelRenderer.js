import { Container, Graphics } from 'pixi.js';
import { TileType } from './MapGenerator.js';

const PALETTE = {
  [TileType.WATER]:        { top: 0x1d5f96, left: 0x0b2547,  right: 0x12345d,  stroke: 0x08203c },
  [TileType.GRASS]:        { top: 0x3f8f34, left: 0x6f4320,  right: 0x915629,  stroke: 0x2c2417 },
  [TileType.PATH]:         { top: 0xcaa46b, left: 0x76502a,  right: 0x9a6837,  stroke: 0x5a3a1e },
  [TileType.CASTLE_WALL]:  { top: 0x9a968b, left: 0x5c574f,  right: 0x716c61,  stroke: 0x3d3a35 },
  [TileType.CASTLE_TOWER]: { top: 0x7f7b73, left: 0x46423d,  right: 0x5a554d,  stroke: 0x302d2a },
  [TileType.ENTRY]:        { top: 0xcaa46b, left: 0x76502a,  right: 0x9a6837,  stroke: 0x5a3a1e },
};

const FIXED_HEIGHTS = {
  [TileType.WATER]:        0,
  [TileType.CASTLE_WALL]:  8,
  [TileType.CASTLE_TOWER]: 12,
};

const MAX_BLOCK_H = 12;

// One distinct colour per path
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
  constructor(app) {
    this.app = app;
    this.container = new Container();
    app.stage.addChild(this.container);
    this._mapData = null;
    this._arrowsVisible = false;
    this._zoom = 1.0;
    this._containerX = 0;
    this._containerY = 0;
  }

  render(mapData) {
    this._mapData = mapData;
    this._zoom = 1.0;
    this._containerX = 0;
    this._containerY = 0;
    this._redraw();
  }

  setArrowsVisible(visible) {
    this._arrowsVisible = visible;
    this._redraw();
  }

  zoomTo(newZoom, pivotX, pivotY) {
    const localX = (pivotX - this._containerX) / this._zoom;
    const localY = (pivotY - this._containerY) / this._zoom;
    this._zoom = newZoom;
    this._containerX = pivotX - localX * newZoom;
    this._containerY = pivotY - localY * newZoom;
    this.container.scale.set(this._zoom);
    this.container.position.set(this._containerX, this._containerY);
  }

  _redraw() {
    this.container.removeChildren();
    if (!this._mapData) return;

    const { grid, cols, rows, arrowData } = this._mapData;
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;

    this.hw = 12;
    this.hh = 6;
    // One vertical height step equals one full isometric tile layer.
    this.bh = this.hh * 2;

    // Centre the diamond in the canvas
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
      this._drawVoxel(g, col, row, this._tileTopHeight(col, row), this._tilePalette(type, col, row));
    }

    for (const { col, row, type } of tiles) {
      if (type !== TileType.WATER) {
        this._drawTopOutline(g, col, row, this._tileTopHeight(col, row), this._tilePalette(type, col, row).stroke);
      }
    }
    this.container.addChild(g);

    if (this._mapData.pipeData?.size) {
      const pg = new Graphics();
      for (const { col, row } of tiles) {
        const pipe = this._mapData.pipeData.get(`${col},${row}`);
        if (pipe) this._drawPipePortal(pg, col, row, pipe);
      }
      this.container.addChild(pg);
    }

    // Arrows in a separate pass so companion tiles (depth = primary+1, drawn after)
    // don't cover the half of the arrow that straddles the tile boundary.
    if (this._arrowsVisible && arrowData) {
      const ag = new Graphics();
      for (const { col, row } of tiles) {
        const info = arrowData.get(`${col},${row}`);
        if (info) this._drawInpaintedArrows(ag, col, row, info);
      }
      this.container.addChild(ag);
    }
    this.container.scale.set(this._zoom);
    this.container.position.set(this._containerX, this._containerY);
  }

  _toScreen(col, row) {
    return {
      x: (col - row) * this.hw + this.originX,
      y: (col + row) * this.hh + this.originY,
    };
  }

  _tileBaseHeight(col, row) {
    const { grid, heightmap } = this._mapData;
    const type = grid[row][col];
    if (type in FIXED_HEIGHTS) return FIXED_HEIGHTS[type];
    // Base terrain = 4 units (3 dirt sides + 1 top); heightmap adds 0–3 extra for hills.
    return 3 + heightmap[row][col];
  }

  _tileTopHeight(col, row) {
    const { grid, pipeData } = this._mapData;
    const type = grid[row][col];
    const baseHeight = this._tileBaseHeight(col, row);

    if (type === TileType.ENTRY) return baseHeight + 0.25;
    if (type === TileType.PATH) {
      return pipeData?.has(`${col},${row}`) ? baseHeight + 0.25 : baseHeight - 0.25;
    }

    return baseHeight;
  }

  _isRouteTileType(type) {
    return type === TileType.PATH || type === TileType.ENTRY;
  }

  _tileTopProfile(col, row) {
    const { grid, cols, rows } = this._mapData;
    const type = grid[row][col];
    const center = this._tileTopHeight(col, row);
    if (!this._isRouteTileType(type)) {
      return { nw: center, ne: center, se: center, sw: center, center };
    }

    const averageCorner = (coords) => {
      const routeHeights = [];
      const landHeights = [];
      for (const [cc, rr] of coords) {
        if (cc < 0 || cc >= cols || rr < 0 || rr >= rows) continue;
        const neighborType = grid[rr][cc];
        if (this._isRouteTileType(neighborType)) {
          routeHeights.push(this._tileTopHeight(cc, rr));
          continue;
        }
        if (neighborType !== TileType.WATER) {
          landHeights.push(this._tileBaseHeight(cc, rr));
        }
      }

      if (routeHeights.length && landHeights.length) {
        const routeAverage = routeHeights.reduce((sum, value) => sum + value, 0) / routeHeights.length;
        const landAverage = landHeights.reduce((sum, value) => sum + value, 0) / landHeights.length;
        return (routeAverage * 2 + landAverage * 3) / 5;
      }

      if (routeHeights.length) {
        return routeHeights.reduce((sum, value) => sum + value, 0) / routeHeights.length;
      }

      if (landHeights.length) {
        return landHeights.reduce((sum, value) => sum + value, 0) / landHeights.length;
      }

      return center;
    };

    const nw = averageCorner([[col, row], [col - 1, row], [col, row - 1], [col - 1, row - 1]]);
    const ne = averageCorner([[col, row], [col + 1, row], [col, row - 1], [col + 1, row - 1]]);
    const se = averageCorner([[col, row], [col + 1, row], [col, row + 1], [col + 1, row + 1]]);
    const sw = averageCorner([[col, row], [col - 1, row], [col, row + 1], [col - 1, row + 1]]);

    return {
      nw,
      ne,
      se,
      sw,
      center: (nw + ne + se + sw) / 4,
    };
  }

  _tilePalette(type, col, row) {
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
      return { ...base, top: shadeColor(base.top, -0.06 + n * 0.1) };
    }

    if (type === TileType.WATER) {
      return { ...base, top: shadeColor(base.top, -0.08 + n * 0.12) };
    }

    if (type === TileType.CASTLE_WALL || type === TileType.CASTLE_TOWER) {
      return { ...base, top: shadeColor(base.top, -0.05 + n * 0.08) };
    }

    return base;
  }

  _drawPipePortal(g, col, row, pipe) {
    const { x: sx, y: sy } = this._toScreen(col, row);
    const topY = sy + this.hh - this._tileTopProfile(col, row).center * this.bh;
    const vx = (pipe.dc - pipe.dr) * this.hw;
    const vy = (pipe.dc + pipe.dr) * this.hh;
    const vlen = Math.hypot(vx, vy);
    if (!vlen) return;

    const dirX = vx / vlen;
    const dirY = vy / vlen;
    const normalX = -dirY;
    const normalY = dirX;
    const sideSign = pipe.kind === 'in' ? 1 : -1;
    const wallX = sx + dirX * this.hw * 0.98 * sideSign;
    const wallY = topY + dirY * this.hh * 0.98 * sideSign;
    const barrelStartX = sx + dirX * this.hw * 0.78 * sideSign;
    const barrelStartY = topY + dirY * this.hh * 0.78 * sideSign;
    const mouthX = sx + dirX * this.hw * 0.2 * sideSign;
    const mouthY = topY + dirY * this.hh * 0.2 * sideSign;

    const wallHalfW = this.hh * 0.9;
    const wallDepth = this.hh * 0.5;
    const wallHeight = this.bh * 2.15;
    const pipeHalfW = this.hh * 0.78;
    const pipeLip = this.hh * 0.28;
    const pipeHeight = this.bh * 1.45;
    const innerInset = this.hh * 0.22;
    const wallPal = {
      top: 0x8b867a,
      face: 0x5f5a52,
      side: 0x756f65,
      stroke: 0x3c3934,
    };
    const pipePal = {
      top: 0x41d95f,
      face: 0x158339,
      side: 0x1ea94b,
      lip: 0x79f28d,
      stroke: 0x0d4d24,
      mouth: 0x102018,
    };

    const wallTopLeftX = wallX - normalX * wallHalfW;
    const wallTopLeftY = wallY - normalY * wallHalfW - wallHeight;
    const wallTopRightX = wallX + normalX * wallHalfW;
    const wallTopRightY = wallY + normalY * wallHalfW - wallHeight;
    const wallBaseLeftX = wallX - normalX * wallHalfW;
    const wallBaseLeftY = wallY - normalY * wallHalfW;
    const wallBaseRightX = wallX + normalX * wallHalfW;
    const wallBaseRightY = wallY + normalY * wallHalfW;

    this._poly(g, [
      wallTopLeftX, wallTopLeftY,
      wallTopRightX, wallTopRightY,
      wallBaseRightX, wallBaseRightY,
      wallBaseLeftX, wallBaseLeftY,
    ], wallPal.face, wallPal.stroke);

    this._poly(g, [
      wallTopLeftX - dirX * wallDepth, wallTopLeftY - dirY * wallDepth,
      wallTopRightX - dirX * wallDepth, wallTopRightY - dirY * wallDepth,
      wallTopRightX, wallTopRightY,
      wallTopLeftX, wallTopLeftY,
    ], wallPal.top, wallPal.stroke);

    const wallSideTopX = wallTopRightX - dirX * wallDepth;
    const wallSideTopY = wallTopRightY - dirY * wallDepth;
    const wallSideBaseX = wallBaseRightX;
    const wallSideBaseY = wallBaseRightY;
    this._poly(g, [
      wallTopRightX, wallTopRightY,
      wallSideTopX, wallSideTopY,
      wallSideBaseX - dirX * wallDepth, wallSideBaseY - dirY * wallDepth,
      wallBaseRightX, wallBaseRightY,
    ], wallPal.side, wallPal.stroke);

    const pipeStartX = barrelStartX;
    const pipeStartY = barrelStartY;
    const pipeEndX = mouthX;
    const pipeEndY = mouthY;

    this._poly(g, [
      pipeStartX - normalX * pipeHalfW, pipeStartY - normalY * pipeHalfW - pipeHeight,
      pipeEndX - normalX * pipeHalfW, pipeEndY - normalY * pipeHalfW - pipeHeight,
      pipeEndX + normalX * pipeHalfW, pipeEndY + normalY * pipeHalfW - pipeHeight,
      pipeStartX + normalX * pipeHalfW, pipeStartY + normalY * pipeHalfW - pipeHeight,
    ], pipePal.top, pipePal.stroke);

    this._poly(g, [
      pipeStartX + normalX * pipeHalfW, pipeStartY + normalY * pipeHalfW - pipeHeight,
      pipeEndX + normalX * pipeHalfW, pipeEndY + normalY * pipeHalfW - pipeHeight,
      pipeEndX + normalX * pipeHalfW, pipeEndY + normalY * pipeHalfW,
      pipeStartX + normalX * pipeHalfW, pipeStartY + normalY * pipeHalfW,
    ], pipePal.side, pipePal.stroke);

    this._poly(g, [
      pipeStartX - normalX * pipeHalfW, pipeStartY - normalY * pipeHalfW - pipeHeight,
      pipeEndX - normalX * pipeHalfW, pipeEndY - normalY * pipeHalfW - pipeHeight,
      pipeEndX - normalX * pipeHalfW, pipeEndY - normalY * pipeHalfW,
      pipeStartX - normalX * pipeHalfW, pipeStartY - normalY * pipeHalfW,
    ], pipePal.face, pipePal.stroke);

    this._poly(g, [
      pipeStartX - normalX * (pipeHalfW + pipeLip * 0.2), pipeStartY - normalY * (pipeHalfW + pipeLip * 0.2) - pipeHeight - pipeLip * 0.18,
      pipeStartX + normalX * (pipeHalfW + pipeLip * 0.2), pipeStartY + normalY * (pipeHalfW + pipeLip * 0.2) - pipeHeight - pipeLip * 0.18,
      pipeStartX + normalX * (pipeHalfW + pipeLip * 0.2), pipeStartY + normalY * (pipeHalfW + pipeLip * 0.2) + pipeLip * 0.18,
      pipeStartX - normalX * (pipeHalfW + pipeLip * 0.2), pipeStartY - normalY * (pipeHalfW + pipeLip * 0.2) + pipeLip * 0.18,
    ], pipePal.lip, pipePal.stroke);

    this._poly(g, [
      pipeEndX - normalX * (pipeHalfW + pipeLip), pipeEndY - normalY * (pipeHalfW + pipeLip) - pipeHeight - pipeLip * 0.4,
      pipeEndX + normalX * (pipeHalfW + pipeLip), pipeEndY + normalY * (pipeHalfW + pipeLip) - pipeHeight - pipeLip * 0.4,
      pipeEndX + normalX * (pipeHalfW + pipeLip), pipeEndY + normalY * (pipeHalfW + pipeLip) + pipeLip * 0.4,
      pipeEndX - normalX * (pipeHalfW + pipeLip), pipeEndY - normalY * (pipeHalfW + pipeLip) + pipeLip * 0.4,
    ], pipePal.lip, pipePal.stroke);

    this._poly(g, [
      pipeEndX - normalX * (pipeHalfW - innerInset), pipeEndY - normalY * (pipeHalfW - innerInset) - pipeHeight + innerInset * 0.4,
      pipeEndX + normalX * (pipeHalfW - innerInset), pipeEndY + normalY * (pipeHalfW - innerInset) - pipeHeight + innerInset * 0.4,
      pipeEndX + normalX * (pipeHalfW - innerInset), pipeEndY + normalY * (pipeHalfW - innerInset) - innerInset * 0.5,
      pipeEndX - normalX * (pipeHalfW - innerInset), pipeEndY - normalY * (pipeHalfW - innerInset) - innerInset * 0.5,
    ], pipePal.mouth, pipePal.stroke);
  }

  _drawVoxel(g, col, row, blockUnits, pal) {
    const { x: sx, y: sy } = this._toScreen(col, row);
    const hw = this.hw, hh = this.hh;
    const profile = this._tileTopProfile(col, row);

    if (blockUnits === 0) {
      this._poly(g, [sx, sy - hh, sx + hw, sy, sx, sy + hh, sx - hw, sy], pal.top, pal.stroke);
      return;
    }

    const { cols, rows } = this._mapData;
    const right = (col + 1 < cols)
      ? this._tileTopProfile(col + 1, row)
      : { nw: 0, ne: 0, se: 0, sw: 0, center: 0 };
    const left = (row + 1 < rows)
      ? this._tileTopProfile(col, row + 1)
      : { nw: 0, ne: 0, se: 0, sw: 0, center: 0 };

    if (right.nw < profile.ne || right.sw < profile.se) {
      this._poly(g, [
        sx + hw, sy - profile.ne * this.bh,
        sx,      sy + hh - profile.se * this.bh,
        sx,      sy + hh - right.sw * this.bh,
        sx + hw, sy - right.nw * this.bh,
      ], pal.right, pal.stroke);
    }

    if (left.nw < profile.sw || left.ne < profile.se) {
      this._poly(g, [
        sx - hw, sy - profile.sw * this.bh,
        sx,      sy + hh - profile.se * this.bh,
        sx,      sy + hh - left.ne * this.bh,
        sx - hw, sy - left.nw * this.bh,
      ], pal.left, pal.stroke);
    }

    this._poly(g, [
      sx,      sy - hh - profile.nw * this.bh,
      sx + hw, sy - profile.ne * this.bh,
      sx,      sy + hh - profile.se * this.bh,
      sx - hw, sy - profile.sw * this.bh,
    ], pal.top, pal.stroke);
  }

  _drawInpaintedArrows(g, col, row, arrowList) {
    const { x: sx, y: sy } = this._toScreen(col, row);
    const hw = this.hw, hh = this.hh;
    const bh = this._tileTopProfile(col, row).center * this.bh;

    const cx = sx;
    const cy = sy - bh;

    const shaftBack = hw * 0.28;
    const shaftTip = hw * 0.08;
    const headFwd = hw * 0.34;
    const headBack = hw * 0.06;
    const headSide = hh * 0.4;

    const N = arrowList.length;
    const spacing = hh * 0.72;

    for (let j = 0; j < N; j++) {
      const { dc, dr, sideDc = 0, sideDr = 0, marker = 'arrow', pathIdx } = arrowList[j];
      const scale = N > 1 ? 0.78 : 1;

      const ddx = (dc - dr) * hw;
      const ddy = (dc + dr) * hh;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      if (len === 0) continue;
      const nx = ddx / len, ny = ddy / len;
      const px = -ny, py = nx;
      const sideX = (sideDc - sideDr) * hw * 0.5;
      const sideY = (sideDc + sideDr) * hh * 0.5;

      const offset = (j - (N - 1) / 2) * spacing;
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

  _drawTopOutline(g, col, row, blockUnits, strokeColor) {
    const { x: sx, y: sy } = this._toScreen(col, row);
    const hw = this.hw, hh = this.hh;
    const profile = this._tileTopProfile(col, row);

    g.moveTo(sx, sy - hh - profile.nw * this.bh);
    g.lineTo(sx + hw, sy - profile.ne * this.bh);
    g.lineTo(sx, sy + hh - profile.se * this.bh);
    g.lineTo(sx - hw, sy - profile.sw * this.bh);
    g.closePath();
    g.stroke({ color: strokeColor, width: 0.55, alpha: 0.62 });
  }

  _poly(g, pts, fillColor, strokeColor = null) {
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill({ color: fillColor });
    if (strokeColor !== null) {
      g.stroke({ color: strokeColor, width: 0.8 });
    }
  }
}
