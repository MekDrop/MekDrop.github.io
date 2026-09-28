export class LavafallGeometry {
  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} waterfall
   * @param {number} cols
   * @param {number} rows
   * @param {import("src/game/objects/ObjectTypes.js").RiverTerminal} terminal
   * @param {number} routeDistance
   */
  append(group, waterfall, cols, rows, terminal, routeDistance) {
    this.#addLavafall(group, waterfall, cols, rows, terminal, routeDistance);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {number} cascade
   * @param {number} cols
   * @param {number} rows
   */
  appendCascadeImpact(group, cascade, cols, rows) {
    this.#addCascadeImpact(group, cascade, cols, rows);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {{x: number, y: number, z: number}} point
   * @param {{x: number, y: number, z: number}} normal
   * @param {import("playcanvas").Color|number} color
   * @param {Array<number>} uv
   * @param {boolean} weld
   * @param {Array<number>} metadata
   * @param {{x: number, y: number, z: number}} source
   */
  #addVertex(group, point, normal, color, uv, weld, metadata = [0, 0], source = [0, 0]) {
    // A bend's inside corner belongs to both ends of its route interval.
    // Keep distinct UVs there instead of stretching one tile's paint into the next.
    const key = weld
      ? `${point[0].toFixed(6)},${point[1].toFixed(6)},${point[2].toFixed(6)}|${uv[0].toFixed(6)},${uv[1].toFixed(6)}|${metadata[0].toFixed(6)},${metadata[1].toFixed(6)}`
      : null;
    if (key && group.weldedVertices.has(key)) {
      return group.weldedVertices.get(key);
    }

    const index = group.positions.length / 3;
    group.positions.push(...point);
    group.normals.push(...normal);
    group.colors.push(...color);
    group.uvs.push(...uv);
    group.uvs1.push(...metadata);
    group.sourceUvs.push(...source);
    if (key) {
      group.weldedVertices.set(key, index);
    }
    return index;
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {Array<{x: number, y: number, z: number}>} points
   * @param {{x: number, y: number, z: number}} normal
   * @param {number} colors
   * @param {boolean} weld
   * @param {Array<number>} metadata
   */
  #addQuad(
    group,
    points,
    normal,
    colors = null,
    weld = false,
    metadata = [0, 0],
  ) {
    const indices = [];
    for (let index = 0; index < points.length; index++) {
      indices.push(
        this.#addVertex(
          group,
          points[index],
          normal,
          colors?.[index] ?? [0, 0, 0, 0],
          [index === 1 || index === 2 ? 1 : 0, index >= 2 ? 1 : 0],
          weld,
          metadata,
        ),
      );
    }
    group.indices.push(
      indices[0],
      indices[1],
      indices[2],
      indices[0],
      indices[2],
      indices[3],
    );
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} waterfall
   * @param {number} cols
   * @param {number} rows
   * @param {import("src/game/objects/ObjectTypes.js").RiverTerminal} terminal
   * @param {number} routeDistance
   */
  #addLavafall(group, waterfall, cols, rows, terminal, routeDistance) {
    const direction = this.#directionVector(waterfall.direction);
    const cross = { col: -direction.row, row: direction.col };
    const centerX = waterfall.col - (cols - 1) / 2;
    const centerZ = waterfall.row - (rows - 1) / 2;
    const top = waterfall.topElevation + 0.012;
    const lipRadius = 0.4;
    const lipStart = 0.5;
    const lipSlices = 12;
    const widthSegments = 12;
    const curtainSegments = terminal
      ? 24
      : Math.max(
          4,
          Math.ceil(
            (waterfall.topElevation - waterfall.bottomElevation) * 6,
          ),
        );
    const totalRows = lipSlices + curtainSegments;
    const curtainTop = top - lipRadius;
    const curtainForward = lipStart + lipRadius;
    const seed = waterfall.col * 53 + waterfall.row * 97;
    const bottomByWidth = Array.from(
      { length: widthSegments + 1 },
      /**
       *
       * @param {undefined} _
       * @param {number} widthIndex
       */
      (_, widthIndex) =>
        terminal
          ? waterfall.bottomElevation +
            0.1 +
            this.#waterfallNoise(seed + widthIndex * 19) * 0.22
          : waterfall.bottomElevation + 0.012,
    );

    /**
     *
     * @param {number} row
     * @param {number} widthIndex
     * @param {number} depthOffset
     */
    const pointAt = (row, widthIndex, depthOffset) => {
      const acrossBase = widthIndex / widthSegments - 0.5;
      if (row <= lipSlices) {
        const progress = row / lipSlices;
        const angle = progress * Math.PI * 0.5;
        const normalForward = Math.sin(angle);
        const normalY = Math.cos(angle);
        const thicknessScale = Math.sin(angle);
        const curvedThickness = depthOffset * thicknessScale;
        const forward =
          lipStart +
          Math.sin(angle) * lipRadius +
          normalForward * curvedThickness;
        const y =
          top -
          (1 - Math.cos(angle)) * lipRadius +
          normalY * curvedThickness;
        return [
          centerX + direction.col * forward + cross.col * acrossBase,
          y,
          centerZ + direction.row * forward + cross.row * acrossBase,
        ];
      }

      const progress = (row - lipSlices) / curtainSegments;
      const taper = terminal ? 1 - Math.max(0, progress - 0.72) * 0.75 : 1;
      const across = acrossBase * taper;
      const edgeWobble =
        widthIndex === 0 || widthIndex === widthSegments
          ? Math.sin(progress * 12.0 + seed * 0.13) * 0.045 * progress
          : 0;
      const forwardWobble =
        Math.sin(progress * 10.0 + acrossBase * 15.0 + seed * 0.07) *
        0.034 *
        progress;
      const layeredBulge =
        Math.sin(acrossBase * Math.PI * 6 + progress * 7.0 + seed) *
        0.014 *
        progress;
      return [
        centerX +
          direction.col *
            (curtainForward +
              depthOffset +
              forwardWobble +
              layeredBulge) +
          cross.col * (across + edgeWobble),
        curtainTop +
          (bottomByWidth[widthIndex] - curtainTop) * progress,
        centerZ +
          direction.row *
            (curtainForward +
              depthOffset +
              forwardWobble +
              layeredBulge) +
          cross.row * (across + edgeWobble),
      ];
    };

    /**
     *
     * @param {number} widthIndex
     */
    const depthOffsetAt = (widthIndex) =>
      Math.sin((widthIndex / widthSegments) * Math.PI) * 0.13;
    /**
     *
     * @param {number} row
     * @param {number} widthIndex
     */
    const colorAt = (row, widthIndex) =>
      this.#waterfallVertexColor(
        row,
        widthIndex,
        lipSlices,
        curtainSegments,
        widthSegments,
        terminal,
      );
    /**
     *
     * @param {number} row
     * @param {number} widthIndex
     */
    const innerColorAt = (row, widthIndex) => {
      const color = colorAt(row, widthIndex);
      color[3] = Math.min(
        color[3],
        Math.round(Math.min(1, row / lipSlices) * 255),
      );
      return color;
    };
    /**
     *
     * @param {number} row
     * @param {number} widthIndex
     */
    const uvAt = (row, widthIndex) => [
      widthIndex / widthSegments,
      routeDistance +
        Math.min(1, row / lipSlices) * lipRadius * Math.PI * 0.5 +
        Math.max(0, (row - lipSlices) / curtainSegments) *
          (waterfall.topElevation - waterfall.bottomElevation - lipRadius),
    ];
    const waterfallMetadata = [direction.col * 2, direction.row * 2];

    this.#addGrid(
      group,
      totalRows,
      widthSegments,
      /**
       *
       * @param {number} row
       * @param {number} widthIndex
       */
      (row, widthIndex) =>
        pointAt(row, widthIndex, depthOffsetAt(widthIndex)),
      [direction.col, 0, direction.row],
      colorAt,
      false,
      false,
      uvAt,
      () => waterfallMetadata,
    );
    const curtainThickness = 0.32;
    /**
     *
     * @param {number} row
     * @param {number} widthIndex
     */
    const innerPointAt = (row, widthIndex) => {
      const point = pointAt(row, widthIndex, depthOffsetAt(widthIndex));
      const lipProgress = Math.min(1, row / lipSlices);
      const angle = lipProgress * Math.PI * 0.5;
      const remainingDepth = 1 - lipProgress;
      const thickness =
        curtainThickness +
        (0.5 - curtainThickness) * remainingDepth * remainingDepth;
      point[0] -= direction.col * Math.sin(angle) * thickness;
      point[1] -= Math.cos(angle) * thickness;
      point[2] -= direction.row * Math.sin(angle) * thickness;
      return point;
    };
    this.#addGrid(
      group,
      totalRows,
      widthSegments,
      innerPointAt,
      [-direction.col, -0.2, -direction.row],
      innerColorAt,
      true,
      false,
      uvAt,
      () => waterfallMetadata,
    );
    for (const widthIndex of [0, widthSegments]) {
      const sideNormal =
        widthIndex === 0
          ? [-cross.col, 0, -cross.row]
          : [cross.col, 0, cross.row];
      for (let row = 0; row < totalRows; row++) {
        this.#addQuad(
          group,
          [
            pointAt(row, widthIndex, depthOffsetAt(widthIndex)),
            pointAt(row + 1, widthIndex, depthOffsetAt(widthIndex)),
            innerPointAt(row + 1, widthIndex),
            innerPointAt(row, widthIndex),
          ],
          sideNormal,
          [
            colorAt(row, widthIndex),
            colorAt(row + 1, widthIndex),
            innerColorAt(row + 1, widthIndex),
            innerColorAt(row, widthIndex),
          ],
          false,
          waterfallMetadata,
        );
      }
    }
    if (terminal) {
      this.#addWaterfallDroplets(
        group,
        waterfall,
        direction,
        cross,
        centerX,
        centerZ,
        curtainForward,
        seed,
      );
    }
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {number} cascade
   * @param {number} cols
   * @param {number} rows
   */
  #addCascadeImpact(group, cascade, cols, rows) {
    const direction = this.#directionVector(cascade.direction);
    const cross = { col: -direction.row, row: direction.col };
    const centerX = cascade.from.col - (cols - 1) / 2;
    const centerZ = cascade.from.row - (rows - 1) / 2;
    const widthSegments = 12;
    const impactColor = [0, 0, 255, 255];

    for (let band = 0; band < 3; band++) {
      const baseForward = 0.94 + band * 0.095;
      const thickness = 0.026 - band * 0.004;
      for (let widthIndex = 0; widthIndex < widthSegments; widthIndex++) {
        /**
         *
         * @param {number} column
         * @param {{front: Array<number>, rear: Array<number>, uvs: Array<number>}} edge
         */
        const pointAt = (column, edge) => {
          const across = column / widthSegments - 0.5;
          const arch = (1 - Math.pow(across * 2, 2)) * (0.045 + band * 0.01);
          const irregularity =
            Math.sin(
              column * 1.73 +
                band * 2.19 +
                cascade.from.col * 0.37 +
                cascade.from.row * 0.51,
            ) * 0.012;
          const forward =
            baseForward + arch + irregularity + edge * thickness;
          return [
            centerX + direction.col * forward + cross.col * across * 0.86,
            cascade.bottomElevation + 0.045,
            centerZ + direction.row * forward + cross.row * across * 0.86,
          ];
        };
        this.#addQuad(
          group,
          [
            pointAt(widthIndex, -1),
            pointAt(widthIndex, 1),
            pointAt(widthIndex + 1, 1),
            pointAt(widthIndex + 1, -1),
          ],
          [0, 1, 0],
          [impactColor, impactColor, impactColor, impactColor],
          false,
          [direction.col, direction.row],
        );
      }
    }
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {import("src/game/objects/ObjectTypes.js").WaterfallDefinition} waterfall
   * @param {{x: number, y: number, z: number}} direction
   * @param {number} cross
   * @param {number} centerX
   * @param {number} centerZ
   * @param {number} curtainForward
   * @param {number} seed
   */
  #addWaterfallDroplets(
    group,
    waterfall,
    direction,
    cross,
    centerX,
    centerZ,
    curtainForward,
    seed,
  ) {
    const fadeElevation =
      waterfall.bottomElevation +
      (waterfall.topElevation - waterfall.bottomElevation) * 0.17;
    for (let index = 0; index < 16; index++) {
      const across =
        (this.#waterfallNoise(seed + index * 37) - 0.5) * 0.72;
      const forward =
        curtainForward +
        0.02 +
        this.#waterfallNoise(seed + index * 61) * 0.13;
      const y =
        fadeElevation -
        this.#waterfallNoise(seed + index * 83) * 1.1;
      const radius =
        0.025 + this.#waterfallNoise(seed + index * 101) * 0.035;
      const height =
        0.1 + this.#waterfallNoise(seed + index * 127) * 0.2;
      this.#addDroplet(
        group,
        [
          centerX + direction.col * forward + cross.col * across,
          y,
          centerZ + direction.row * forward + cross.row * across,
        ],
        radius,
        height,
        [direction.col * 2, direction.row * 2],
      );
    }
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {number} center
   * @param {number} radius
   * @param {number} height
   * @param {Array<number>} metadata
   */
  #addDroplet(group, center, radius, height, metadata) {
    const top = [center[0], center[1] + height / 2, center[2]];
    const bottom = [center[0], center[1] - height / 2, center[2]];
    const ring = [
      [center[0] - radius, center[1], center[2]],
      [center[0], center[1], center[2] - radius],
      [center[0] + radius, center[1], center[2]],
      [center[0], center[1], center[2] + radius],
    ];
    for (let index = 0; index < ring.length; index++) {
      const next = ring[(index + 1) % ring.length];
      this.#addTriangle(
        group,
        [top, ring[index], next],
        [0, 1, 0],
        null,
        metadata,
      );
      this.#addTriangle(
        group,
        [bottom, next, ring[index]],
        [0, -1, 0],
        null,
        metadata,
      );
    }
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {Array<{x: number, y: number, z: number}>} points
   * @param {{x: number, y: number, z: number}} normal
   * @param {number} colors
   * @param {Array<number>} metadata
   */
  #addTriangle(group, points, normal, colors = null, metadata = [0, 0]) {
    const start = group.positions.length / 3;
    for (let index = 0; index < points.length; index++) {
      group.positions.push(...points[index]);
      group.normals.push(...normal);
      group.colors.push(...(colors?.[index] ?? [0, 0, 0, 0]));
      group.uvs.push(index === 1 ? 1 : 0, index === 2 ? 1 : 0);
      group.uvs1.push(...metadata);
      group.sourceUvs.push(0, 0);
    }
    group.indices.push(start, start + 1, start + 2);
  }

  /**
   *
   * @param {import("src/game/objects/ObjectTypes.js").RiverGeometryGroup} group
   * @param {number} rowSegments
   * @param {number} columnSegments
   * @param {(...args: number[]) => Array<number>} pointAt
   * @param {{x: number, y: number, z: number}} normal
   * @param {number} colorAt
   * @param {boolean} reverseWinding
   * @param {boolean} weld
   * @param {(...args: number[]) => Array<number>} uvAt
   * @param {(...args: number[]) => Array<number>} metadataAt
   * @param {(...args: number[]) => Array<number>} sourceAt
   */
  #addGrid(
    group,
    rowSegments,
    columnSegments,
    pointAt,
    normal,
    colorAt = null,
    reverseWinding = false,
    weld = false,
    uvAt = null,
    metadataAt = null,
    sourceAt = null,
  ) {
    const vertices = [];
    for (let row = 0; row <= rowSegments; row++) {
      for (let column = 0; column <= columnSegments; column++) {
        vertices.push(
          this.#addVertex(
            group,
            pointAt(row, column),
            normal,
            colorAt?.(row, column) ?? [0, 0, 0, 0],
            uvAt?.(row, column) ?? [column / columnSegments, row / rowSegments],
            weld,
            metadataAt?.(row, column) ?? [0, 0],
            sourceAt?.(row, column) ?? [0, 0],
          ),
        );
      }
    }

    const rowWidth = columnSegments + 1;
    for (let row = 0; row < rowSegments; row++) {
      for (let column = 0; column < columnSegments; column++) {
        const topLeft = vertices[row * rowWidth + column];
        const topRight = vertices[row * rowWidth + column + 1];
        const bottomLeft = vertices[(row + 1) * rowWidth + column];
        const bottomRight = vertices[(row + 1) * rowWidth + column + 1];
        if (reverseWinding) {
          group.indices.push(
            topLeft,
            bottomRight,
            topRight,
            topLeft,
            bottomLeft,
            bottomRight,
          );
        } else {
          group.indices.push(
            topLeft,
            topRight,
            bottomRight,
            topLeft,
            bottomRight,
            bottomLeft,
          );
        }
      }
    }
  }

  /**
   *
   * @param {number} row
   * @param {number} widthIndex
   * @param {Array<{left: {x: number, y: number, z: number}, right: {x: number, y: number, z: number}}>} lipSlices
   * @param {number} curtainSegments
   * @param {number} widthSegments
   * @param {import("src/game/objects/ObjectTypes.js").RiverTerminal} terminal
   */
  #waterfallVertexColor(
    row,
    widthIndex,
    lipSlices,
    curtainSegments,
    widthSegments,
    terminal,
  ) {
    const across = Math.round((widthIndex / widthSegments) * 255);
    const lipProgress = Math.min(1, row / lipSlices);
    const fallProgress = Math.max(
      0,
      Math.min(1, (row - lipSlices) / curtainSegments),
    );
    let opacity = 1;
    if (terminal) {
      const fadeProgress = Math.max(
        0,
        Math.min(1, (fallProgress - 0.72) / 0.28),
      );
      const smoothFade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
      opacity = 1 - smoothFade;
    }
    return [
      across,
      Math.round(fallProgress * 255),
      Math.round(lipProgress * 255),
      Math.round(opacity * 255),
    ];
  }

  /**
   *
   * @param {number} seed
   */
  #waterfallNoise(seed) {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  }

  /**
   *
   * @param {{x: number, y: number, z: number}} direction
   */
  #directionVector(direction) {
    if (direction === 'NORTH') {
      return { col: 0, row: -1 };
    }
    if (direction === 'EAST') {
      return { col: 1, row: 0 };
    }
    if (direction === 'SOUTH') {
      return { col: 0, row: 1 };
    }
    return { col: -1, row: 0 };
  }
}
