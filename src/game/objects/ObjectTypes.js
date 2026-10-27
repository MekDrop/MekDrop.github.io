/**
 * Shared structural JSDoc contracts for map objects.
 *
 * @typedef {{x: number, y: number, z: number}} Point3
 * @typedef {{col: number, row: number}} GridPoint
 * @typedef {{col: number, row: number, elevation?: number, terrainHeight?: number, direction?: string, flowScale?: number}} RiverCell
 * @typedef {object} MapObjectDefinition
 * @property {string} id
 * @property {string|number} [firewoodSeed] Repeatable FirewoodStack layout; defaults to its id.
 * @property {string|number} [spearSeed] Repeatable SpearRack spear variation; defaults to its id.
 * @property {number} [length] SpearRack line length along local X, or BridgeRailing run length, in metres.
 * @property {number} [postSpacing] Maximum BridgeRailing bay length; posts divide the run evenly.
 * @property {Point3} [direction] World-space BridgeRailing heading, normalized during assembly.
 * @property {string|number} [timberSeed] Repeatable SpareTimberBundle layout; defaults to its id.
 * @property {string|number} [linenSeed] Repeatable FoldedLinens bundle layout; defaults to its id.
 * @property {import("./castle-props/lantern/Lantern.js").LanternLighting|false} [lighting] Lantern-local illumination override.
 * @property {boolean} [castleBrazier] Generated castle brazier owned by sourceCastleId.
 * @property {number} [phase] Stable fire flicker phase.
 * @property {boolean} [flame] Override a lantern or brazier flame. Tower braziers are unlit by default.
 * @property {{halfExtents: Point3, offset: Point3}} [collisionBox] Model-space lantern contact box.
 * @property {{position: Point3, width: number, depth: number}} [opening] Ladder clearance geometry, independent of a hatch.
 * @property {string} [hatchId] Optional independent Hatch controlling passage.
 * @property {boolean} [locked] Hatch refuses opening while locked.
 * @property {Point3} [bottom] Ladder lower landing in world coordinates.
 * @property {Point3} [top] Ladder upper landing in world coordinates; together with bottom defines placement and heading when position/rotation are omitted.
 * @property {MapObjectDefinition[]} [items] Contained game objects; an explicit position preserves a local authored pose, otherwise the container packs them (Shelf spaces them along its bottom board).
 * @property {string} [carrierId] Servant owning an activity ServingTray.
 * @property {string} object Registered class name.
 * @property {string} [basePlanId] Explicit authored castle layout; omitted uses seed selection.
 * @property {"entrance"|"wall"|"table"|"court"} [type] Lantern or lectern model selection.
 * @property {string} [symbol] Gateway banner override.
 * @property {import("../navigation/WalkingPaths.js").WalkingEntry} [entry]
 * @property {Array<import("../generator/map/MapGenerationTypes.js").RiverData>} [rivers]
 * @property {import("../generator/map/MapGenerationTypes.js").GroundCoverData} [placements]
 * @property {PathOverpass} [layout]
 * @property {import("../GameContracts.js").GameMapData["islandConnectorData"]} [topology]
 * @property {import("../GameContracts.js").CastleLayout} [navigation]
 * @property {Point3} [position]
 * @property {number} [level] Block bottom elevation when position is omitted.
 * @property {boolean} [generated]
 * @property {RenderCommand} [geometry]
 * @property {boolean} [castleBanner] Banner extracted from castle decorations.
 * @property {string} [variant] Prop artwork/model variant. SignalBell uses framed (default) or ceiling. Brazier uses bowl (default) or tower. Shelf uses a ranged book cabinet by default or storage with position/rotation. Bed uses royal (default) or servant. CandleStand uses single (default), floor, table, court (tall brass), or courtTable (small brass). Bench uses wall (default) or island. Satchel uses brown (default) or olive, preserving each model's authored leather finish. Banner uses navy-and-gold artwork by default or cloth for castle artwork; both simulate cloth.
 * @property {boolean} [isOpen] Whether the Book is open (default false), independent of its location.
 * @property {string} [pose] Book model's resting pose: flat (default) or upright; tilt and rotation control final orientation.
 * @property {string} [style] Book artwork style; classic retains the older painted open volume in any location.
 * @property {number[]} [coverColor] Book binding color as sRGB components from 0 to 1.
 * @property {string} [sourceShelfId] Cabinet owning a generated Book's packing and shared collision.
 * @property {boolean} [castleShelf] Generated castle shelf ownership marker.
 * @property {boolean} [shelfItem] Supplied shelf content published as a map object.
 * @property {boolean} [books] Shelf includes books by default; false allows an empty cabinet.
 * @property {boolean} [booksAsObjects] Shelf contents have been published as separate map objects.
 * @property {number} [weathering] Prop wear from 0 (fresh) to 1 (fully aged).
 * @property {number} [fillLevel] WaterBucket fill from 0 (empty) to 1 (full); defaults to 0.65.
 * @property {number} [rotation]
 * @property {Point3} [from] Shelf bottom edge, window corner, or WoodenFloor surface corner in world coordinates.
 * @property {Point3} [to] Shelf bottom edge or opposite window corner (one differing ground axis); WoodenFloor opposite surface corner (both ground axes differ, equal Y).
 * @property {Point3} [volume] Fire box full dimensions; position is its bottom center.
 * @property {number} [intensity] Fire brightness multiplier (default 1); zero disables the flames. Volume controls their dimensions.
 * @property {number} [width] Table/firewood/linen area width in metres, painting horizontal scale, or flag cloth width.
 * @property {number} [height] Table, firewood/linen pile, bookshelf, window, or flag cloth height.
 * @property {number} [chimneyHeight] Fireplace base to the covering roof surface, in metres.
 * @property {{width: number, depth: number}} [footprint] World-sized bed collision envelope.
 * @property {number} [collisionRotation] Furniture collision heading, in degrees.
 * @property {boolean} [castleTable] Generated castle table ownership marker.
 * @property {boolean} [deskContents] Keep authored writing desk parchment and ink pot.
 * @property {boolean} [castleWardrobe] Generated castle wardrobe ownership marker.
 * @property {boolean} [castleBed] Generated castle bed ownership marker.
 * @property {number} [poleHeight] Flag pole height in metres (default 1.25).
 * @property {string} [model] Authored rug asset filename under models/rug; omitted uses woven-rug.glb.
 * @property {string} [texture] Cloth image URL; omitted keeps the flag or rug default fabric.
 * @property {{baseY: number, height: number, clearance?: number}} [roofCollider] Flag roof contact shape passed to cloth physics.
 * @property {string} [sourceCastleId] Castle that supplied a migrated flag.
 * @property {number} [sourceCastleSeed] Seed used to generate the migrated flag.
 * @property {number} [facing] Shelf/window front direction, 1 or -1 on the perpendicular axis.
 * @property {boolean} [joinStart] Shelf shares its local left upright with the previous section.
 * @property {boolean} [joinEnd] Shelf supplies a slimmer shared upright at its local right edge.
 * @property {number} [depth] Table/firewood/linen area depth in metres or window reveal depth (default 0.3).
 * @property {number} [radius] Straight staircase half-run and default lane width.
 * @property {number} [rise] Straight staircase total vertical rise.
 * @property {number} [flightGap] Separation between straight stair lanes.
 * @property {number} [flightShift] Local Z displacement of straight flights.
 * @property {number} [landingBack] Local rear extent of a turning landing.
 * @property {number} [landingLift] Additional turning landing elevation.
 * @property {{minX:number,maxX:number,inner:number}} [flightBounds] Explicit straight stair lane bounds.
 * @property {boolean} [continuesAbove] A stacked flight owns the next opening.
 * @property {boolean} [exitFloorOwned] Adjoining floor supplies the exit apron's visible surface.
 * @property {number} [Z1] Spiral staircase lower map elevation (world Y).
 * @property {number} [Z2] Spiral staircase upper map elevation (world Y), above Z1.
 * @property {"standard"|"castle"} [stepProfile] Castle uses 20 cm closed risers, 12 degree treads with a 120 degree level landing and a matching rising handrail.
 * @property {number} [columnTop] Spiral column top elevation, when a landing caps the column.
 * @property {{col: number, row: number}} [tile]
 * @property {Array<{offsetX: number, offsetZ: number, diameter: number, height: number}>} [parts]
 * @property {boolean} [active] Runtime pressure-plate latch preserved during object replacement.
 * @property {string} [seedSignId] Castle seed inscription binding.
 * @property {string} [script]
 * @property {string|number} [color]
 * @property {{id: string, contents: Array<string>}} [buriedTreasure]
 * @property {{id: string, contents: Array<string>}} [buriedTreasure]
 * @typedef {{method: string, args: Array}} RenderCommand
 * @typedef {object} GameMapData
 * @property {{panels: import("../ui/MapTestControlsHud.js").MapTestPanel[]}} [testControls]
 * @property {number} cols
 * @property {number} rows
 * @property {string} [mapName]
 * @property {Array<Array<number|string>>} grid
 * @property {Array<Array<number>>} heightmap
 * @property {Array<Array<{shape?: string, overpassId?: string, bridgeGroundHeight?: number, renderMode?: string}>>} [tileMeta]
 * @property {Array<MapObjectDefinition>} [objects]
 * @property {import("../cache/CompiledMapCache.js").CompiledMapLayout} [compiledMap]
 * @property {Array<RenderCommand>} [renderCommands]
 * @property {Array<{id?: string, sourceId?: string, branchStart?: number, kind?: string, cells: Array<RiverCell>, cascades: Array<RiverCascade>, waterfall: WaterfallDefinition}>} [riverData]
 * @property {PathOverpass} [overpassData]
 * @property {{horizontal: boolean, station: number, cells: Array<{col: number, row: number}>, removedCells: Array<{col: number, row: number}>, nearIsland: string[], farIsland: string[], islands?: string[][]}} [islandConnectorData]
 * @property {{position: {col: number, row: number, width: number, depth: number}}} [castle]
 * @typedef {object} MapObjectRuntime
 * @property {import("../audio/GameAudioLibrary.js").GameAudioLibrary} [audioLibrary]
 * @property {(definition: MapObjectDefinition) => MapObjectLike} [createObject] Creates a registered child object owned by its container.
 * @property {Array<import("playcanvas").Material>} [materials]
 * @property {() => HeroLike} [getHero]
 * @property {(item: MapObjectLike) => void} [onCollectibleRemoved]
 * @property {(definition: MapObjectDefinition) => Promise<boolean>} [replaceObjectDefinition]
 * @property {GameMapData} [mapData]
 * @property {Iterable<MapObjectLike>} [objects]
 * @property {import("playcanvas").Entity} [root]
 * @property {{zoom: number}} [camera]
 * @property {import("src/game/collision/GroundCollisionWorld.js").GroundCollisionWorld} [collisionWorld]
 * @property {import("src/game/rendering/terrain/TerrainInstanceRenderer.js").TerrainInstanceRenderer} [instanceRenderer]
 * @property {number} [sideVariantCount]
 * @property {(value: string) => string} [resolveMaterial]
 * @property {(resolve: (value: string) => string) => void} [setMaterialResolver]
 * @property {() => Array<MapObjectLike>} [getContactProviders]
 * @property {(job: () => void|Iterator<void>) => void} [deferDecoration] Chunked scene work completed before revealing the map.
 * @property {{earth: import("./terrain/EarthSurfaceMaterials.js").EarthSurfaceMaterials, grass: import("./terrain/GrassSurfaceMaterials.js").GrassSurfaceMaterials}} [surfaceMaterials]
 * @property {{carpet: import("./ground-cover/GrassCarpet.js").GrassCarpet, surface: import("./ground-cover/GrassSurface.js").GrassSurface}} [canopy]
 * @property {(definition: MapObjectDefinition) => void} [onObjectRemoved]
 * @property {(error: Error) => void} [onRuntimeError]
 * @property {(position: Point3, radius: number) => Array<Point3>} [getGrassSupportPoints]
 * @typedef {object} MapObjectLike
 * @property {string} [testStatus]
 * @property {import("playcanvas").Entity} entity
 * @property {MapObjectDefinition} [definition]
 * @property {() => void} destroy
 * @property {() => void} [onSceneReady]
 * @property {() => Promise<void>} [onSceneReadyAsync] Optional staged replacement setup while loading effects animate.
 * @property {(x: number, z: number, radius?: number) => number|null} [surfaceHeightAt]
 * @property {(x: number, z: number, radius?: number) => number|null} [physicsSurfaceHeightAt]
 * @property {(x: number, z: number) => number|null} [capsuleSupportHeightAt]
 * @property {(position: Point3) => InteractionLike|null} [getInteraction]
 * @typedef {object} InteractionLike
 * @property {string} [description]
 * @property {() => void} [begin]
 * @property {(deltaTime: number) => void} [advance]
 * @property {() => void} [cancel]
 * @typedef {object} HeroLike
 * @property {(options: {targetPosition: Point3, onImpact: () => boolean, onComplete: () => void}) => boolean} [openChest]
 * @property {import("playcanvas").Entity} entity
 * @property {Point3} position
 * @property {Point3} facingDirection
 * @property {number} [facing]
 * @property {boolean} [grounded]
 * @property {(item: import("./ground-cover/GroundCoverCollectible.js").GroundCoverCollectible) => boolean} [collectInventoryItem]
 * @property {(interaction: InteractionLike|null) => void} [setInteraction]
 * @typedef {object} HeroActionPayload
 * @property {() => void} [onScoop]
 * @property {(action: HeroActionPayload) => boolean} [onCycle]
 * @property {(action: HeroActionPayload, previous: import("playcanvas").Vec3[], current: import("playcanvas").Vec3[]) => void} [onContact]
 * @property {() => void} [onSoilReleased]
 * @property {string} [phase]
 * @property {number} [cutStartTime]
 * @property {number} [liftStartTime]
 * @property {number} [toolHideTime]
 * @property {number} [stowStartTime]
 * @property {Record<string, string|number|boolean>} [toolContext]
 * @property {number} [useDuration]
 * @property {number} [strokeDuration]
 * @property {number[]} [impactTimes]
 * @property {number} [impactIndex]
 * @property {Point3} [direction]
 * @property {Point3} [targetPosition]
 * @property {number} [remaining]
 * @property {number} [duration]
 * @property {number} [speed]
 * @property {boolean} [positioning]
 * @property {InteractionLike} [interaction]
 * @typedef {object} HeroActionContext
 * @property {HeroActionPayload|null} payload
 * @property {number} deltaTime
 * @property {(action: string, payload: HeroActionPayload|null) => void} transition
 * @property {() => void} finish
 * @property {Point3} [bridgeClimbEnd]
 * @property {number} [dodgeAnimationDuration]
 * @property {number} [edgeRefusalDuration]
 * @property {number} [holeRefusalDuration]
 * @property {number} [blockedDigReactionDuration]
 * @property {number} [repelDuration]
 * @property {number} [repelSpeed]
 * @property {HeroActionFeedback} feedback
 * @property {HeroActionFeedback} feedback
 * @typedef {object} RiverCascade
 * @property {RiverCell} from
 * @property {RiverCell} to
 * @property {string} direction
 * @typedef {object} WaterfallDefinition
 * @property {number} col
 * @property {number} row
 * @property {string} direction
 * @property {number} topElevation
 * @property {number} bottomElevation
 * @typedef {object} RiverTerminal
 * @property {number} radius
 * @property {number} depth
 * @property {number} surfaceElevation
 * @typedef {object} WaterfallJoin
 * @property {Array<Array<number>>} front
 * @property {Array<Array<number>>} rear
 * @property {Array<Array<number>>} uvs
 * @property {Array<Array<number>>} sources
 * @property {boolean[]} [connectedSides] Perpendicular spills at the negative and positive width edges.
 * @typedef {object} PathOverpass
 * @property {Array<{col: number, row: number, riseDirection: string, lowHeight: number, highHeight: number}>} slopeCells
 * @property {Array<GridPoint>} approachCells
 * @property {Array<GridPoint>} crossingCells
 * @property {{col: number, row: number, width: number}} crossing
 * @property {number} deckElevation
 * @typedef {object} CastleDoorDefinition
 * @property {"rounded"|"pointed"} [style]
 * @property {string} side
 * @property {number} offset
 * @property {number} width
 * @property {number} height
 * @property {string} [kind]
 * @typedef {object} CastleBuildPlan
 * @property {Array<CastleDoorDefinition>} doors
 * @property {Array<{side: string, start: number, end: number}>} walls
 * @property {Array<{x: number, z: number, width: number, depth: number}>} rooms
 * @typedef {object} TerraceActivityState
 * @property {string} [phase]
 * @property {boolean} [active]
 * @property {boolean} [carryingTable]
 * @property {boolean} [carryingTea]
 * @property {number} [bookOpenAmount]
 * @property {Point3} [position]
 * @property {number} [rotation]
 */

/**
 * @typedef {object} MapObjectOptions
 * @property {typeof import("playcanvas")} pc
 * @property {import("playcanvas").Application} app
 * @property {import("../models/GameModelLibrary.js").GameModelLibrary} modelLibrary
 * @property {MapObjectDefinition} definition
 * @property {MapObjectRuntime} runtime
 */

export {};
