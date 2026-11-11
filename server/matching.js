// Decides whether a posting suits a food bank's receiving profile. Used to
// label postings for food banks and to pick who gets new-posting alerts.

const parseHours = (openHours) => {
  const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(openHours || "");
  if (!match) return null;
  const [, h1, m1, h2, m2] = match.map(Number);
  return { open: h1 * 100 + m1, close: h2 * 100 + m2 };
};

// Returns the reasons a posting doesn't fit; an empty list means it fits.
// Missing information on either side never counts against a posting.
function fitProblems(posting, foodBank) {
  const problems = [];
  const accepted = foodBank.acceptedFoodTypes || [];
  const types = posting.foodTypes || [];
  if (accepted.length && types.length && !types.some((t) => accepted.includes(t))) {
    problems.push("food_type");
  }

  const storage = posting.storage || "ambient";
  if ((storage === "refrigerated" || storage === "frozen") && !(foodBank.coldStorage || []).includes(storage)) {
    problems.push(storage === "frozen" ? "needs_freezer" : "needs_fridge");
  }

  if (foodBank.maxPickupKg && posting.estimatedWeightKg && posting.estimatedWeightKg > foodBank.maxPickupKg) {
    problems.push("too_heavy");
  }

  const days = foodBank.receivingDays || [];
  if (days.length && posting.pickupDate) {
    const weekday = new Date(`${posting.pickupDate}T12:00:00Z`).getUTCDay();
    if (!days.includes(weekday)) problems.push("day");
  }

  const hours = parseHours(foodBank.openHours);
  if (hours && hours.close > hours.open) {
    const overlaps = posting.pickupTimeBegin < hours.close && posting.pickupTimeEnd > hours.open;
    if (!overlaps) problems.push("hours");
  }

  return problems;
}

module.exports = { fitProblems, parseHours };
