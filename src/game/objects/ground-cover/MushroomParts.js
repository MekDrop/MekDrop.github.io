/**
 * Individual authored mushrooms within the shared cluster assets.
 * @param {string} variant
 */
export const mushroomParts = (variant) => {
  switch (variant) {
    case "forest-mushroom-cluster":
      return ["Forest mushroom one", "Forest mushroom two", "Forest mushroom three"];
    case "golden-mushroom-pair":
      return ["Tall golden mushroom", "Small golden mushroom"];
    default:
      return [""];
  }
};

/**
 * A collected part's index is already encoded in its inventory identity.
 * Resolve that identity without treating the entire source asset as one item.
 * @param {{id: string, variant: string}} item
 * @returns {string}
 */
export const inventoryMushroomPart = (item) => {
  const parts = mushroomParts(item.variant);
  if (parts.length === 1) {
    return "";
  }
  const index = Number(item.id.split(":").at(-1));

  return parts[index] ?? "";
};
