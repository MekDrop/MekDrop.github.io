
/**
 * @typedef {object} TileMetadata
 * @property {string} [shape]
 * @property {string} [direction]
 * @property {string} [surfaceType]
 * @property {string} [renderMode]
 * @property {number} [baseHeight]
 * @property {string} [overpassId]
 * @property {string} [overpassPlateauId]
 * @property {string} [pathDipId]
 * @property {number|null} [bridgeGroundHeight]
 * @property {SlopeProfile} [slope]
 * @property {{elevation: number, direction: string}} [overpass]
 * @property {number} [x]
 * @property {number} [y]
 */

/**
 * @typedef {object} MapLayout
 * @property {number} [castleLeft]
 * @property {number} [castleRight]
 * @property {number} [castleTop]
 * @property {number} [castleBottom]
 * @property {number} [castleEntranceCol]
 * @property {number[]} [castleEntranceRows]
 * @property {number[]} [pathRows]
 * @property {LayoutEntry[]} [entries]
 * @property {OverpassPlan|null} [overpassPlan]
 * @property {PathDipPlan[]} [pathDipPlans]
 * @property {TerrainEllipse[]} [islandEllipses]
 * @property {TerrainEllipse[]} [hillEllipses]
 * @property {{width: number, depth: number, style: string}} [castleFootprint]
 * @property {string} [signature]
 */

/**
 * @typedef {object} LayoutEntry
 * @property {number} gateCol
 * @property {number[]} gateRows
 * @property {number} mergeCol
 * @property {string} side
 * @property {string} [inwardDirection]
 * @property {{bands: number[][], turnCols: number[]}} [curvePlan]
 */

/**
 * @typedef {object} MapCell
 * @property {number} col
 * @property {number} row
 * @property {number} [col2]
 * @property {number} [row2]
 * @property {number} [elevation]
 * @property {number} [terrainHeight]
 * @property {string} [direction]
 * @property {boolean} [underBridge]
 */

/**
 * @typedef {object} OverpassPlan
 * @property {string} [id]
 * @property {string} [axis]
 * @property {number} [start]
 * @property {number} [end]
 * @property {number} [cross]
 * @property {number} [deckElevation]
 * @property {{col: number, row: number, width: number, depth: number}} [crossing]
 * @property {SlopeCell[]} [slopeCells]
 * @property {MapCell[]} [crossingCells]
 * @property {MapCell[]} [approachCells]
 * @property {MapCell[]} [raisedApproachCells]
 * @property {MapCell[]} [raisedTerrainCells]
 * @property {boolean} [raisedEntryApproach]
 * @property {number} [baseElevation]
 * @property {number} [upperPathIdx]
 * @property {string} [upperDirection]
 * @property {string} [lowerDirection]
 */

/**
 * @typedef {object} RiverRecord
 * @property {string} kind
 * @property {MapCell[]} cells
 * @property {MapCell} [source]
 * @property {string} id
 * @property {number} upstreamLength
 * @property {RiverCascade[]} cascades
 * @property {WaterfallRecord} waterfall
 */

/**
 * @typedef {object} RouteRecord
 * @property {MapCell[]} [route]
 * @property {Set<string>} [routeCells]
 * @property {number} [cost]
 */

/**
 * @typedef {object} GenerationTemplate
 * @property {number} [weight]
 * @property {string} [id]
 * @property {number[]} [pathRows]
 */

/**
 * @typedef {object} GenerationYieldState
 * @property {number} lastYield
 */

/**
 * @typedef {GroundCoverPlacement[]} GroundCoverData
 */

/**
 * @typedef {object} MapGenerationOptions
 * @property {string} [mapName]
 * @property {number} [numPaths]
 * @property {number} [numRivers]
 * @property {boolean|OverpassPlan} [overpass]
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {string|number|boolean|MapCell|MapLayout|TileMetadata[][]|number[][]|string[][]|GenerationYieldState} MapGenerationArgument
 */

/**
 * @typedef {{col: number, row: number}} GridCell
 */

/**
 * @typedef {{col: number, row: number, underBridge?: boolean, terrainHeight?: number}} RiverCell
 */

/**
 * @typedef {RiverRecord} RiverData
 */

/**
 * @typedef {{routeCells: Set<string>}} RouteData
 */

/**
 * @typedef {{col2: number, row2: number, elevation?: number}} RouteWaypoint
 */

/**
 * @typedef {object} PathDipSpan
 * @property {string} axis
 * @property {number} cross
 * @property {number} start
 * @property {number} end
 * @property {string} direction
 */

/**
 * @typedef {PathDipSpan & {id: string, elevation: number, rampTiles: number, slopeCells: SlopeCell[], flatCells: GridCell[], landingCells: GridCell[]}} PathDipPlan
 */

/**
 * @typedef {{col: number, row: number, variant: string, kind?: string, rotation?: number}} VegetationPlacement
 */

/**
 * @typedef {{col: number, row: number, parts: StonePart[]}} StonePlacement
 */

/**
 * @typedef {object} StonePart
 * @property {number} variant
 * @property {number} style
 * @property {string} color
 * @property {number} levels
 * @property {number} offsetX
 * @property {number} offsetZ
 * @property {number} diameter
 * @property {number} height
 * @property {number} rotation
 */

/**
 * @typedef {GridCell & {variant: string, rotation: number, offsetX: number, offsetZ: number}} GroundCoverPlacement
 */

/**
 * @typedef {{lowHeight: number, highHeight: number, riseDirection: string}} SlopeProfile
 */

/**
 * @typedef {GridCell & SlopeProfile} SlopeCell
 */

/**
 * @typedef {{centerCol: number, centerRow: number, radiusX: number, radiusY: number, height?: number}} TerrainEllipse
 */

/**
 * @typedef {{from: GridCell, to: GridCell, direction: string, topElevation: number, bottomElevation: number}} RiverCascade
 */

/**
 * @typedef {GridCell & {direction: string, topElevation: number, bottomElevation: number}} WaterfallRecord
 */

export {};
