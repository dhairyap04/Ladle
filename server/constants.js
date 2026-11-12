// Vocabularies shared by postings and food bank profiles. The client keeps the
// matching labels in client/src/food.js.

const FOOD_TYPES = [
  "prepared_meals",
  "produce",
  "bakery",
  "dairy_eggs",
  "meat_fish",
  "pantry",
  "beverages",
  "other",
];

// Health Canada's priority food allergens. "none" means the donor confirmed
// the food contains none of them; an empty list means they didn't say.
const ALLERGENS = [
  "peanuts",
  "tree_nuts",
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "wheat",
  "soy",
  "sesame",
  "mustard",
  "sulphites",
];

// How the food has to be kept until it's collected.
const STORAGE = ["ambient", "refrigerated", "frozen", "hot"];

module.exports = { FOOD_TYPES, ALLERGENS, STORAGE };
