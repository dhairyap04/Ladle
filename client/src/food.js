// Labels for the vocabularies in server/constants.js.

export const FOOD_TYPES = {
  prepared_meals: "Prepared meals",
  produce: "Fruit & vegetables",
  bakery: "Bread & bakery",
  dairy_eggs: "Dairy & eggs",
  meat_fish: "Meat & fish",
  pantry: "Pantry & dry goods",
  beverages: "Drinks",
  other: "Other",
};

// Health Canada's priority food allergens.
export const ALLERGENS = {
  peanuts: "Peanuts",
  tree_nuts: "Tree nuts",
  milk: "Milk",
  eggs: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish",
  wheat: "Wheat / gluten",
  soy: "Soy",
  sesame: "Sesame",
  mustard: "Mustard",
  sulphites: "Sulphites",
};

export const STORAGE = {
  ambient: { label: "Room temperature", short: "Room temp" },
  refrigerated: { label: "Keep refrigerated", short: "Refrigerated" },
  frozen: { label: "Keep frozen", short: "Frozen" },
  hot: { label: "Hot, ready to serve", short: "Hot" },
};

// A sentence about a posting's allergens.
export function allergenSummary(allergens = []) {
  if (allergens.includes("none")) return "No priority allergens";
  if (allergens.length === 0) return "Not specified — ask the restaurant";
  return `Contains ${allergens.map((a) => ALLERGENS[a] || a).join(", ").toLowerCase()}`;
}

export const photoUrl = (posting) =>
  `${import.meta.env.REACT_APP_HOST_URL}posting/${posting._id}/photo?v=${encodeURIComponent(posting.updatedAt || "")}`;
