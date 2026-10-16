// Grounded GLB heights measured with inspect-glb; refresh when source assets change.
export const ROOM_PROP_HEIGHTS = {
  "BedsideDrawers": 0.65,
  "Throne": 1,
  "Bowl": 0.231,
  "ChoppingToolsSet": 0.0485,
  "Lectern": 0.75,
  "DeskGlobe": 0.4,
  "DeskParchment": 0.0376,
  "FireplaceCauldron": 0.65,
  "FirewoodStack": 0.2433,
  "FoldedLinens": 0.16,
  "HangingFryingPan": 0.5786,
  "Fireplace": 1.65,
  "KitchenUtensilRail": 0.1984,
  "StepStool": 0.4,
  "ParchmentBundle": 0.1341,
  "RoyalCrest": 0.8,
  "Basket": 0.2774,
  "ClothRoll": 0.14193024,
  "ThreadSpool": 0.11621472,
  "SpareTimberBundle": 0.72,
  "SpearRack": 1.2,
  "PotteryJar": 0.3,
  "Planter": 0.99,
  "ServingTray": 0.1175,
  "Sunbed": 0.76,
  "Teacup": 0.2165,
  "Teapot": 0.472,
  "ThroneDais": 0.1,
  "TowerBrazier": 0.7,
  "StandingArmor": 1.75,
  "Banner": 1.012,
  "Bench": 0.82,
  "Boots": 0.28,
  "VestibuleCloakRail": 1.365,
  "VestibuleStickStand": 1.05,
  "TravelKit": 0.45,
  "WarCouncilShield": 0.85,
  "Barrel": 0.65,
  "Crate": 0.4702,
  "Chair": 0.85,
  "Chest": 0.3291,
  "WashBasin": 0.2362,
  "WaterBucket": 0.388,
  "Rug": 0.025,
  "Table": 0.5647,
  "Book": 0.04,
  "Lantern": 0.45,
  "CandleStand": 0.6387,
};
export const ROOM_PROP_BOTTOMS = {
  "BedsideDrawers": 0,
  "Throne": 0,
  "Bowl": 0,
  "ChoppingToolsSet": 0,
  "Lectern": 0,
  "DeskGlobe": 0,
  "DeskParchment": 0,
  "FireplaceCauldron": 0,
  "FirewoodStack": 0,
  "FoldedLinens": 0,
  "HangingFryingPan": 0,
  "Fireplace": 0,
  "KitchenUtensilRail": 0,
  "StepStool": 0,
  "ParchmentBundle": 0,
  "RoyalCrest": 0,
  "Basket": 0,
  "ClothRoll": 0,
  "ThreadSpool": 0,
  "SpareTimberBundle": 0,
  "SpearRack": 0,
  "PotteryJar": 0,
  "Planter": 0,
  "ServingTray": 0.01,
  "Sunbed": 0,
  "Teacup": 0,
  "Teapot": 0,
  "ThroneDais": 0,
  "TowerBrazier": 0,
  "StandingArmor": 0,
  "Banner": -0.985,
  "Bench": 0,
  "Boots": 0,
  "VestibuleCloakRail": -0.591,
  "VestibuleStickStand": 0,
  "TravelKit": 0,
  "WarCouncilShield": 0,
  "Barrel": 0,
  "Crate": 0,
  "Chair": 0,
  "Chest": 0,
  "WashBasin": 0,
  "WaterBucket": 0,
  "Rug": 0,
  "Table": 0,
  "Book": 0,
  "Lantern": 0,
  "CandleStand": 0,
};

/**
 * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
 * @param {number} fallback
 * @returns {number}
 */
export function roomPropHeight(item, fallback) {
  if (item.height !== undefined) { return item.height; }
  if (item.properties?.height !== undefined) { return item.properties.height; }
  if (item.object === "Table" && (item.variant ?? item.properties?.variant) === "writingDesk") { return item.properties?.height ?? 0.65; }
  if (item.object === "Book" && item.properties?.isOpen) { return item.properties.style === "classic" ? 0.1607 : 0.0673; }
  if (item.object === "CandleStand") { return (item.variant ?? item.properties?.variant) === "floor" ? 0.5836 : (item.variant ?? item.properties?.variant) === "table" ? 0.2311 : 0.6387; }
  if (item.object === "Lantern" && item.properties?.type === "wall") { return 0.6; }
  if (item.object === "Bench" && item.variant === "island") { return 1.05; }
  return ROOM_PROP_HEIGHTS[item.object] ?? fallback;
}

/**
 * @param {import("./AbstractCastleRoomGenerator.js").RoomItem} item
 * @returns {number}
 */
export function roomPropBottom(item) {
  if (item.object === "Table" && item.properties?.height === 1.0622) { return 0.0128; }
  if (item.object === "Book" && item.properties?.style === "classic") { return 0.0005; }
  return ROOM_PROP_BOTTOMS[item.object] ?? 0;
}
