import {
  GateRouteMissingError,
  InvalidRouteWaypointError,
  NonOrthogonalRouteSegmentError,
} from "../../errors/map/index.js";
import {
  PATH_HEIGHT,
  OVERPASS_RAMP_TILES,
  OVERPASS_HALF_STEP,
  MIN_ARROW_GATE_CLEARANCE,
  MIN_ARROW_CASTLE_CLEARANCE,
} from "./mapGenerationConfig.js";

/**
 * @typedef {import("./MapGenerationTypes.js").MapLayout} MapLayout
 * @typedef {import("./MapGenerationTypes.js").LayoutEntry} LayoutEntry
 * @typedef {import("./MapGenerationTypes.js").MapCell} MapCell
 * @typedef {import("./MapGenerationTypes.js").OverpassPlan} OverpassPlan
 * @typedef {import("./MapGenerationTypes.js").RouteWaypoint} RouteWaypoint
 * @typedef {import("./MapGenerationTypes.js").PathDipPlan} PathDipPlan
 */

/**
 * Builds elevation-aware quickest routes and arrows from the validated layout.
 */
export class RouteDataBuilder {
  /**
   * @param {number} col2
   * @param {number} row2
   * @param {number} elevation
   */
  #routeNodeKey(col2, row2, elevation = PATH_HEIGHT) {
    return `${col2},${row2},${Math.round(elevation * 1000) / 1000}`;
  }

  /**
   * @param {RouteWaypoint[]} waypoints
   * @param {number} col2
   * @param {number} row2
   */
  #appendRouteWaypoint(waypoints, col2, row2) {
    const previous = waypoints[waypoints.length - 1];
    if (previous?.col2 === col2 && previous?.row2 === row2) {
      return;
    }
    waypoints.push({ col2, row2 });
  }

  /**
   * @param {MapLayout} layout
   * @param {LayoutEntry} entry
   */
  #buildRouteWaypoints(layout, entry) {
    const waypoints = [];
    const gateCenterRow2 = entry.gateRows[0] + entry.gateRows[1];
    const trunkCenterRow2 = layout.pathRows[0] + layout.pathRows[1];
    const mergeCenterCol2 = entry.mergeCol * 2 + 1;

    this.#appendRouteWaypoint(waypoints, entry.gateCol * 2, gateCenterRow2);

    if (entry.curvePlan) {
      const { bands, turnCols } = entry.curvePlan;
      for (let index = 0; index < bands.length; index++) {
        const turnCenterCol2 = turnCols[index] * 2 + 1;
        const bandCenterRow2 = bands[index][0] + bands[index][1];
        this.#appendRouteWaypoint(
          waypoints,
          turnCenterCol2,
          waypoints[waypoints.length - 1].row2,
        );
        this.#appendRouteWaypoint(waypoints, turnCenterCol2, bandCenterRow2);
      }
    }

    this.#appendRouteWaypoint(
      waypoints,
      mergeCenterCol2,
      waypoints[waypoints.length - 1].row2,
    );
    this.#appendRouteWaypoint(waypoints, mergeCenterCol2, trunkCenterRow2);
    this.#appendRouteWaypoint(
      waypoints,
      layout.castleEntranceCol * 2,
      trunkCenterRow2,
    );

    return waypoints;
  }

  /**
   * @param {RouteWaypoint[]} waypoints
   */
  #expandRouteWaypoints(waypoints) {
    const points = [{ ...waypoints[0] }];

    for (let index = 1; index < waypoints.length; index++) {
      const destination = waypoints[index];
      const current = points[points.length - 1];
      if (
        ![current.col2, current.row2, destination.col2, destination.row2].every(
          Number.isInteger,
        )
      ) {
        throw new InvalidRouteWaypointError();
      }
      const deltaCol = destination.col2 - current.col2;
      const deltaRow = destination.row2 - current.row2;
      if (deltaCol !== 0 && deltaRow !== 0) {
        throw new NonOrthogonalRouteSegmentError();
      }

      const stepCol = Math.sign(deltaCol);
      const stepRow = Math.sign(deltaRow);
      let col2 = current.col2;
      let row2 = current.row2;
      while (col2 !== destination.col2 || row2 !== destination.row2) {
        col2 += stepCol;
        row2 += stepRow;
        points.push({ col2, row2 });
      }
    }

    return points;
  }

  /**
   * @param {Map<string, Set<string>>} graph
   * @param {RouteWaypoint} first
   * @param {RouteWaypoint} second
   */
  #connectRouteNodes(graph, first, second) {
    const firstKey = this.#routeNodeKey(
      first.col2,
      first.row2,
      first.elevation,
    );
    const secondKey = this.#routeNodeKey(
      second.col2,
      second.row2,
      second.elevation,
    );
    if (!graph.has(firstKey)) { graph.set(firstKey, new Set()); }
    if (!graph.has(secondKey)) { graph.set(secondKey, new Set()); }
    graph.get(firstKey).add(secondKey);
    graph.get(secondKey).add(firstKey);
  }

  /**
   * @param {Map<string, Set<string>>} graph
   * @param {string} targetKey
   */
  #buildRouteDistances(graph, targetKey) {
    const distances = new Map([[targetKey, 0]]);
    const queue = [targetKey];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const key = queue[queueIndex++];
      const distance = distances.get(key);
      for (const neighbor of graph.get(key) ?? []) {
        if (distances.has(neighbor)) { continue; }
        distances.set(neighbor, distance + 1);
        queue.push(neighbor);
      }
    }

    return distances;
  }

  /**
   * @param {Map<string, Set<string>>} graph
   * @param {Map<string, number>} distances
   * @param {string} startKey
   * @param {string} targetKey
   */
  #followQuickestRoute(graph, distances, startKey, targetKey) {
    const route = [];
    let key = startKey;

    while (true) {
      const [col2, row2, elevation] = key.split(",").map(Number);
      route.push({ col: col2 / 2, row: row2 / 2, elevation });
      if (key === targetKey) {
        return route;
      }

      const distance = distances.get(key);
      const nextKey = [...(graph.get(key) ?? [])]
        .filter(/**
         *
         * @param {string} neighbor
         */
        (neighbor) => distances.get(neighbor) === distance - 1)
        .sort()[0];

      if (!nextKey) {
        throw new GateRouteMissingError();
      }
      key = nextKey;
    }
  }

  /**
   * @param {MapCell[][]} routes
   */
  #buildArrowData(routes) {
    const arrowData = new Map();

    routes.forEach(/**
     *
     * @param {MapCell[]} route
     * @param {number} pathIdx
     */
    (route, pathIdx) => {
      const turnIndices = new Set();
      const distancesToCastle = new Array(route.length).fill(0);
      for (let index = 1; index < route.length - 1; index++) {
        const previous = route[index - 1];
        const current = route[index];
        const next = route[index + 1];
        const incomingDc = current.col - previous.col;
        const incomingDr = current.row - previous.row;
        const outgoingDc = next.col - current.col;
        const outgoingDr = next.row - current.row;
        if (incomingDc !== outgoingDc || incomingDr !== outgoingDr) {
          turnIndices.add(index);
        }
      }
      for (let index = route.length - 2; index >= 0; index--) {
        distancesToCastle[index] =
          distancesToCastle[index + 1] +
          Math.hypot(
            route[index + 1].col - route[index].col,
            route[index + 1].row - route[index].row,
          );
      }

      let distanceFromGate = 0;
      for (let index = 1; index < route.length - 1; index++) {
        const current = route[index];
        const next = route[index + 1];
        const previous = route[index - 1];
        distanceFromGate += Math.hypot(
          current.col - previous.col,
          current.row - previous.row,
        );
        if (
          distanceFromGate <= MIN_ARROW_GATE_CLEARANCE ||
          distancesToCastle[index] <= MIN_ARROW_CASTLE_CLEARANCE
        ) {
          continue;
        }
        let dc = next.col - current.col;
        let dr = next.row - current.row;
        const previousDc = current.col - previous.col;
        const previousDr = current.row - previous.row;
        const startsTurn = turnIndices.has(index);
        if (startsTurn) {
          dc += previousDc;
          dr += previousDr;
        } else if (
          [...turnIndices].some(/**
           *
           * @param {number} turnIndex
           */
          (turnIndex) => Math.abs(turnIndex - index) <= 2)
        ) {
          continue;
        }
        const col2 = Math.round(current.col * 2);
        const row2 = Math.round(current.row * 2);
        const colParity = Math.abs(col2) % 2;
        const rowParity = Math.abs(row2) % 2;
        if (startsTurn) {
          if (colParity !== 1 || rowParity !== 1) {
            continue;
          }
        } else if (colParity === rowParity) {
          continue;
        }

        const axis2 = dc === 0 ? row2 : col2;
        if (!startsTurn && Math.abs(axis2) % 4 !== 0) { continue; }

        const elevation = current.elevation ?? PATH_HEIGHT;
        const nextElevation = next.elevation ?? PATH_HEIGHT;
        const segmentLength = Math.hypot(
          next.col - current.col,
          next.row - current.row,
        );
        const surfacePitch = segmentLength
          ? (Math.atan2(nextElevation - elevation, segmentLength) * 180) /
            Math.PI
          : 0;
        const key = `${col2 / 2},${row2 / 2},${elevation}`;
        const arrows = arrowData.get(key) ?? [];
        arrows.push({
          dc,
          dr,
          elevation,
          marker: startsTurn ? "turn" : "arrow",
          pathIdx,
          surfacePitch,
        });
        arrowData.set(key, arrows);
      }
    });

    return arrowData;
  }

  /**
   * @param {MapLayout} layout
   */
  buildRouteData(layout) {
    const graph = new Map();
    const rawRoutes = layout.entries.map(/**
     *
     * @param {LayoutEntry} entry
     * @param {number} pathIdx
     */
    (entry, pathIdx) => {
      const route = this.#applyRouteElevations(
        this.#expandRouteWaypoints(this.#buildRouteWaypoints(layout, entry)),
        pathIdx,
        layout.overpassPlan,
        layout.pathDipPlans,
      );
      for (let index = 1; index < route.length; index++) {
        this.#connectRouteNodes(graph, route[index - 1], route[index]);
      }
      return route;
    });
    const targetKey = this.#routeNodeKey(
      layout.castleEntranceCol * 2,
      layout.pathRows[0] + layout.pathRows[1],
      PATH_HEIGHT,
    );
    const distances = this.#buildRouteDistances(graph, targetKey);
    const routes = rawRoutes.map(/**
     *
     * @param {RouteWaypoint[]} route
     */
    (route) =>
      this.#followQuickestRoute(
        graph,
        distances,
        this.#routeNodeKey(route[0].col2, route[0].row2, route[0].elevation),
        targetKey,
      ),
    );

    return { routes, arrowData: this.#buildArrowData(routes) };
  }

  /**
   * @param {RouteWaypoint[]} route
   * @param {number} pathIdx
   * @param {OverpassPlan|null} overpassPlan
   * @param {PathDipPlan[]} pathDipPlans
   */
  #applyRouteElevations(route, pathIdx, overpassPlan, pathDipPlans) {
    const crossingCol2 = overpassPlan?.crossing.col * 2 + 1;
    const crossingRow2 = overpassPlan?.crossing.row * 2 + 1;
    const raisedEntryEndIndex = overpassPlan?.raisedEntryApproach
      ? route.findIndex(
          /**
           *
           * @param {RouteWaypoint} point
           */
          (point) => point.col2 === crossingCol2 && point.row2 === crossingRow2,
        )
      : -1;
    return route.map(/**
     *
     * @param {RouteWaypoint} point
     * @param {number} pointIndex
     */
    (point, pointIndex) => {
      let elevation = this.#terrainPathDipElevation(point, pathDipPlans);
      if (
        overpassPlan &&
        pathIdx === overpassPlan.upperPathIdx &&
        raisedEntryEndIndex >= 0 &&
        pointIndex <= raisedEntryEndIndex
      ) {
        return { ...point, elevation: overpassPlan.deckElevation };
      }
      if (
        overpassPlan &&
        pathIdx === overpassPlan.upperPathIdx &&
        point.col2 === crossingCol2
      ) {
        const distance = Math.abs(point.row2 - crossingRow2) / 2;
        if (distance <= 2) {
          elevation = overpassPlan.deckElevation;
        } else if (distance <= 2 + OVERPASS_RAMP_TILES) {
          elevation =
            overpassPlan.deckElevation -
            (distance - 2) * OVERPASS_HALF_STEP;
        }
      }
      return { ...point, elevation };
    });
  }

  /**
   * @param {RouteWaypoint} point
   * @param {PathDipPlan[]} plans
   */
  #terrainPathDipElevation(point, plans = []) {
    for (const plan of plans) {
      const crossCoordinate2 = plan.cross * 2 + 1;
      const pointCrossCoordinate2 =
        plan.axis === "HORIZONTAL" ? point.row2 : point.col2;
      if (pointCrossCoordinate2 !== crossCoordinate2) {
        continue;
      }

      const pointCoordinate2 =
        plan.axis === "HORIZONTAL" ? point.col2 : point.row2;
      const rampTiles = plan.rampTiles ?? 1;
      const startEdge2 = plan.start * 2 - 1;
      const startLowEdge2 = (plan.start + rampTiles) * 2 - 1;
      const endLowEdge2 = (plan.end - rampTiles) * 2 + 1;
      const endEdge2 = plan.end * 2 + 1;
      if (pointCoordinate2 < startEdge2 || pointCoordinate2 > endEdge2) {
        continue;
      }
      if (pointCoordinate2 <= startLowEdge2) {
        return (
          PATH_HEIGHT -
          ((pointCoordinate2 - startEdge2) / (2 * rampTiles)) *
            (PATH_HEIGHT - plan.elevation)
        );
      }
      if (pointCoordinate2 <= endLowEdge2) {
        return plan.elevation;
      }
      return (
        plan.elevation +
        ((pointCoordinate2 - endLowEdge2) / (2 * rampTiles)) *
          (PATH_HEIGHT - plan.elevation)
      );
    }
    return PATH_HEIGHT;
  }
}
