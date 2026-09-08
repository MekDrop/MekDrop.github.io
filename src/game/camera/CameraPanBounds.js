import { DEFAULT_CONTROLS } from "../config/controls.js";

const MINIMUM_MAP_INSET_PIXELS = 32;
const VISIBILITY_TOLERANCE = 0.000001;
const INSET_SEARCH_STEPS = 18;
const PAN_SEGMENT_SEARCH_STEPS = 24;
const MINIMUM_ZOOM = DEFAULT_CONTROLS.zoom.min;
const FULL_STRUCTURE_PAN_ZOOM = DEFAULT_CONTROLS.zoom.max;

export class CameraPanBounds {
  #tileCenters = [];
  #visualPoints = [];
  #visualGroups = new Map();
  #protectedVisualGroups = new Set();
  #alwaysCenteredVisualGroups = new Set();
  #allowedHullCacheKey = "";
  #allowedHullCache = [];

  constructor(mapData) {
    const { grid, heightmap, cols, rows } = mapData ?? {};
    if (!grid || !Number.isFinite(cols) || !Number.isFinite(rows)) {
      return;
    }

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const height = heightmap?.[row]?.[col];
        if (!Number.isFinite(height) || height <= 0) {
          continue;
        }
        const x = col - (cols - 1) / 2;
        const z = row - (rows - 1) / 2;
        this.#tileCenters.push({ x, y: height, z });
        for (const y of [0, height]) {
          this.#visualPoints.push(
            { x: x - 0.5, y, z: z - 0.5 },
            { x: x + 0.5, y, z: z - 0.5 },
            { x: x + 0.5, y, z: z + 0.5 },
            { x: x - 0.5, y, z: z + 0.5 },
          );
        }
      }
    }
  }

  addVisualBounds(
    center,
    halfExtents,
    {
      group = "scenery",
      protectAtPanLimit = false,
      centerReachableAtEveryZoom = false,
    } = {},
  ) {
    if (!center || !halfExtents) {
      return;
    }
    const groupPoints = this.#visualGroups.get(group) ?? [];
    for (const xDirection of [-1, 1]) {
      for (const yDirection of [-1, 1]) {
        for (const zDirection of [-1, 1]) {
          const point = {
            x: center.x + halfExtents.x * xDirection,
            y: center.y + halfExtents.y * yDirection,
            z: center.z + halfExtents.z * zDirection,
          };
          this.#visualPoints.push(point);
          groupPoints.push(point);
        }
      }
    }
    this.#visualGroups.set(group, groupPoints);
    if (protectAtPanLimit) {
      this.#protectedVisualGroups.add(group);
    }
    if (centerReachableAtEveryZoom) {
      this.#alwaysCenteredVisualGroups.add(group);
    }
    this.#allowedHullCacheKey = "";
  }

  constrain(view, origin = null) {
    if (view.zoom <= 1) {
      return { x: view.centerX, z: view.centerZ };
    }
    const frame = this.#frame(view);
    const allowedHull = this.#extendedAllowedHull(
      this.#allowedTargetHull(frame),
      frame,
    );
    if (allowedHull.length === 0) {
      return { x: view.centerX, z: view.centerZ };
    }
    const target = this.#project(
      { x: view.panX, y: view.targetY, z: view.panZ },
      frame,
    );
    const projectedOrigin = origin
      ? this.#project(
          { x: origin.x, y: view.targetY, z: origin.z },
          frame,
        )
      : null;
    const constrainedTarget = projectedOrigin
      ? this.#furthestAllowedPoint(projectedOrigin, target, allowedHull)
      : this.#closestPointInPolygon(target, allowedHull);
    const constrainedDepth =
      (constrainedTarget.y + frame.cosPitch * view.targetY) / frame.sinPitch;

    return {
      x: constrainedTarget.x * frame.cosYaw + constrainedDepth * frame.sinYaw,
      z:
        -constrainedTarget.x * frame.sinYaw +
        constrainedDepth * frame.cosYaw,
    };
  }

  visibility(view) {
    const frame = this.#frame(view);
    const allowedHull = this.#extendedAllowedHull(
      this.#allowedTargetHull(frame),
      frame,
    );
    const target = this.#project(
      { x: view.panX, y: view.targetY, z: view.panZ },
      frame,
    );
    const safeVisibleTileCenters = this.#tileCenters.reduce((count, point) => {
      const projected = this.#project(point, frame);
      const visible =
        Math.abs(projected.x - target.x) <=
          frame.safeHalfWidth + VISIBILITY_TOLERANCE &&
        Math.abs(projected.y - target.y) <=
          frame.safeHalfHeight + VISIBILITY_TOLERANCE;
      return count + Number(visible);
    }, 0);

    return {
      safeVisibleTileCenters,
      totalTileCenters: this.#tileCenters.length,
      insetPixels: frame.insetPixels,
      viewportWidth: frame.viewportWidth,
      viewportHeight: frame.viewportHeight,
      panWithinBounds:
        view.zoom <= 1 || this.#contains(target, allowedHull),
      visualGroups: Object.fromEntries(
        [...this.#visualGroups].map(([name, points]) => [
          name,
          this.#screenBounds(points, target, frame),
        ]),
      ),
    };
  }

  #screenBounds(points, target, frame) {
    const projected = points.map((point) => this.#project(point, frame));
    const worldPerPixel = (frame.halfHeight * 2) / frame.viewportHeight;
    const screenPoints = projected.map((point) => ({
      x: frame.viewportWidth / 2 + (point.x - target.x) / worldPerPixel,
      y: frame.viewportHeight / 2 + (point.y - target.y) / worldPerPixel,
    }));
    return {
      left: Math.min(...screenPoints.map(({ x }) => x)),
      top: Math.min(...screenPoints.map(({ y }) => y)),
      right: Math.max(...screenPoints.map(({ x }) => x)),
      bottom: Math.max(...screenPoints.map(({ y }) => y)),
    };
  }

  #extendedAllowedHull(allowedHull, frame) {
    const points = [...allowedHull];
    const zoomRange = Math.max(
      VISIBILITY_TOLERANCE,
      FULL_STRUCTURE_PAN_ZOOM - MINIMUM_ZOOM,
    );
    const extension = this.#clamp(
      (frame.zoom - MINIMUM_ZOOM) / zoomRange,
      0,
      1,
    );
    for (const name of this.#protectedVisualGroups) {
      const bounds = this.#projectedBounds(
        this.#visualGroups.get(name) ?? [],
        frame,
      );
      if (!bounds) {
        continue;
      }
      const width = bounds.maximumX - bounds.minimumX;
      const height = bounds.maximumY - bounds.minimumY;
      if (width > frame.safeHalfWidth * 2 || height > frame.safeHalfHeight * 2) {
        continue;
      }
      const minimumX = bounds.maximumX - frame.safeHalfWidth;
      const maximumX = bounds.minimumX + frame.safeHalfWidth;
      const minimumY = bounds.maximumY - frame.safeHalfHeight;
      const maximumY = bounds.minimumY + frame.safeHalfHeight;
      const centerX = (minimumX + maximumX) / 2;
      const centerY = (minimumY + maximumY) / 2;
      const center = { x: centerX, y: centerY };
      const nearestBasePoint =
        allowedHull.length > 0
          ? this.#closestPointInPolygon(center, allowedHull)
          : center;
      const centerExtension = this.#alwaysCenteredVisualGroups.has(name)
        ? 1
        : extension;
      const anchorX =
        nearestBasePoint.x +
        (centerX - nearestBasePoint.x) * centerExtension;
      const anchorY =
        nearestBasePoint.y +
        (centerY - nearestBasePoint.y) * centerExtension;
      const halfRangeX =
        ((maximumX - minimumX) / 2) * centerExtension;
      const halfRangeY = ((maximumY - minimumY) / 2) * extension;
      points.push(
        { x: anchorX - halfRangeX, y: anchorY - halfRangeY },
        { x: anchorX + halfRangeX, y: anchorY - halfRangeY },
        { x: anchorX + halfRangeX, y: anchorY + halfRangeY },
        { x: anchorX - halfRangeX, y: anchorY + halfRangeY },
      );
    }
    return this.#convexHull(points);
  }

  #projectedBounds(points, frame) {
    if (points.length === 0) {
      return null;
    }
    const projected = points.map((point) => this.#project(point, frame));
    return {
      minimumX: Math.min(...projected.map(({ x }) => x)),
      minimumY: Math.min(...projected.map(({ y }) => y)),
      maximumX: Math.max(...projected.map(({ x }) => x)),
      maximumY: Math.max(...projected.map(({ y }) => y)),
    };
  }

  #allowedTargetHull(frame) {
    const cacheKey = [
      frame.cosYaw,
      frame.sinYaw,
      frame.halfWidth,
      frame.halfHeight,
      this.#visualPoints.length,
    ].join(":");
    if (cacheKey === this.#allowedHullCacheKey) {
      return this.#allowedHullCache;
    }
    const projectedHull = this.#convexHull(
      this.#visualPoints.map((point) => this.#project(point, frame)),
    );
    if (projectedHull.length < 3) {
      return this.#cacheAllowedHull(cacheKey, projectedHull);
    }

    const fullyInset = this.#insetHull(projectedHull, frame, 1);
    if (this.#hasArea(fullyInset)) {
      return this.#cacheAllowedHull(cacheKey, fullyInset);
    }

    let minimumScale = 0;
    let maximumScale = 1;
    let allowedHull = projectedHull;
    for (let iteration = 0; iteration < INSET_SEARCH_STEPS; iteration += 1) {
      const scale = (minimumScale + maximumScale) / 2;
      const candidate = this.#insetHull(projectedHull, frame, scale);
      if (this.#hasArea(candidate)) {
        minimumScale = scale;
        allowedHull = candidate;
      } else {
        maximumScale = scale;
      }
    }
    return this.#cacheAllowedHull(cacheKey, allowedHull);
  }

  #cacheAllowedHull(cacheKey, hull) {
    this.#allowedHullCacheKey = cacheKey;
    this.#allowedHullCache = hull;
    return hull;
  }

  #insetHull(hull, frame, scale) {
    let polygon = hull;
    for (let index = 0; index < hull.length; index += 1) {
      const start = hull[index];
      const end = hull[(index + 1) % hull.length];
      const edgeX = end.x - start.x;
      const edgeY = end.y - start.y;
      const inset =
        scale *
        (Math.abs(edgeX) * frame.halfHeight +
          Math.abs(edgeY) * frame.halfWidth);
      polygon = this.#clipPolygon(polygon, start, end, inset);
      if (polygon.length === 0) {
        return polygon;
      }
    }
    return polygon;
  }

  #clipPolygon(polygon, edgeStart, edgeEnd, inset) {
    const clipped = [];
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentDistance =
        this.#cross(edgeStart, edgeEnd, current) - inset;
      const previousDistance =
        this.#cross(edgeStart, edgeEnd, previous) - inset;
      const currentInside = currentDistance >= -VISIBILITY_TOLERANCE;
      const previousInside = previousDistance >= -VISIBILITY_TOLERANCE;

      if (currentInside !== previousInside) {
        const progress = previousDistance / (previousDistance - currentDistance);
        clipped.push({
          x: previous.x + (current.x - previous.x) * progress,
          y: previous.y + (current.y - previous.y) * progress,
        });
      }
      if (currentInside) {
        clipped.push(current);
      }
    }
    return clipped;
  }

  #closestPointInPolygon(point, polygon) {
    if (this.#contains(point, polygon)) {
      return point;
    }
    let nearest = polygon[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const candidate = this.#closestPointOnSegment(point, start, end);
      const distance =
        (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  #closestPointOnSegment(point, start, end) {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX ** 2 + deltaY ** 2;
    if (lengthSquared <= VISIBILITY_TOLERANCE) {
      return start;
    }
    const progress = this.#clamp(
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
      0,
      1,
    );
    return {
      x: start.x + deltaX * progress,
      y: start.y + deltaY * progress,
    };
  }

  #furthestAllowedPoint(start, end, polygon) {
    if (this.#contains(end, polygon)) {
      return end;
    }
    if (!this.#contains(start, polygon)) {
      return this.#closestPointInPolygon(end, polygon);
    }
    let minimumProgress = 0;
    let maximumProgress = 1;
    for (let iteration = 0; iteration < PAN_SEGMENT_SEARCH_STEPS; iteration += 1) {
      const progress = (minimumProgress + maximumProgress) / 2;
      const candidate = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      };
      if (this.#contains(candidate, polygon)) {
        minimumProgress = progress;
      } else {
        maximumProgress = progress;
      }
    }
    return {
      x: start.x + (end.x - start.x) * minimumProgress,
      y: start.y + (end.y - start.y) * minimumProgress,
    };
  }

  #contains(point, polygon) {
    if (polygon.length === 0) {
      return false;
    }
    if (polygon.length === 1) {
      return (
        Math.hypot(point.x - polygon[0].x, point.y - polygon[0].y) <=
        VISIBILITY_TOLERANCE
      );
    }
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      if (this.#cross(start, end, point) < -VISIBILITY_TOLERANCE) {
        return false;
      }
    }
    return true;
  }

  #convexHull(points) {
    const uniquePoints = [
      ...new Map(
        points.map((point) => [`${point.x}:${point.y}`, point]),
      ).values(),
    ].sort((left, right) => left.x - right.x || left.y - right.y);
    if (uniquePoints.length <= 2) {
      return uniquePoints;
    }

    const buildHalf = (orderedPoints) => {
      const half = [];
      for (const point of orderedPoints) {
        while (
          half.length >= 2 &&
          this.#cross(half.at(-2), half.at(-1), point) <= 0
        ) {
          half.pop();
        }
        half.push(point);
      }
      return half;
    };
    const lower = buildHalf(uniquePoints);
    const upper = buildHalf([...uniquePoints].reverse());
    lower.pop();
    upper.pop();
    return [...lower, ...upper];
  }

  #hasArea(polygon) {
    if (polygon.length < 3) {
      return false;
    }
    let doubledArea = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const point = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      doubledArea += point.x * next.y - point.y * next.x;
    }
    return Math.abs(doubledArea) > VISIBILITY_TOLERANCE;
  }

  #frame({
    rotation,
    pitch,
    zoom,
    orthoHeight,
    viewportWidth,
    viewportHeight,
  }) {
    const yaw = Math.PI / 4 + rotation * (Math.PI / 2);
    const width = Math.max(1, viewportWidth);
    const height = Math.max(1, viewportHeight);
    const halfHeight = Math.max(Number.EPSILON, orthoHeight);
    const halfWidth = halfHeight * (width / height);
    const worldPerPixel = (halfHeight * 2) / height;
    const insetPixels = Math.min(
      MINIMUM_MAP_INSET_PIXELS,
      width / 4,
      height / 4,
    );
    const inset = insetPixels * worldPerPixel;

    return {
      cosYaw: Math.cos(yaw),
      sinYaw: Math.sin(yaw),
      sinPitch: Math.sin(pitch),
      cosPitch: Math.cos(pitch),
      zoom,
      halfWidth,
      halfHeight,
      safeHalfWidth: Math.max(0, halfWidth - inset),
      safeHalfHeight: Math.max(0, halfHeight - inset),
      insetPixels,
      viewportWidth: width,
      viewportHeight: height,
    };
  }

  #project(point, frame) {
    const depth = point.x * frame.sinYaw + point.z * frame.cosYaw;
    return {
      x: point.x * frame.cosYaw - point.z * frame.sinYaw,
      y: depth * frame.sinPitch - point.y * frame.cosPitch,
    };
  }

  #cross(origin, first, second) {
    return (
      (first.x - origin.x) * (second.y - origin.y) -
      (first.y - origin.y) * (second.x - origin.x)
    );
  }

  #clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
}
