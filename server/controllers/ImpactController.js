const mongoose = require("mongoose");
const mongoFoodPostings = require("../models/Postings");
const mongoUsers = require("../models/Users");
const { formatWindow } = require("../format");

// Feeding America's conversion: one meal is about 1.2 lb (0.544 kg) of food.
const KG_PER_MEAL = 0.544;

// Completed donations where the user was the restaurant or the food bank.
const completedFilter = (user) => ({
  status: "picked_up",
  ...(user.isFoodbank ? { claimedBy: new mongoose.Types.ObjectId(user.id) } : { donorId: new mongoose.Types.ObjectId(user.id) }),
});

const monthKey = (date) => date.toISOString().slice(0, 7); // "2026-11"

// GET /impact — totals, the last 12 months, food types and top partners.
const getImpact = async (req, res) => {
  const postings = await mongoFoodPostings
    .find(completedFilter(req.user), "pickedUpAt updatedAt estimatedWeightKg foodTypes donorId fromRestaurantName claimedBy claimedByName")
    .lean();

  const totalKg = postings.reduce((sum, p) => sum + (p.estimatedWeightKg || 0), 0);
  const withoutWeight = postings.filter((p) => !p.estimatedWeightKg).length;

  // Last 12 calendar months (UTC), oldest first, including empty ones.
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ month: monthKey(d), donations: 0, kg: 0 });
  }
  const byMonth = Object.fromEntries(months.map((m) => [m.month, m]));
  const foodTypes = {};
  const partners = {};
  for (const p of postings) {
    const m = byMonth[monthKey(p.pickedUpAt || p.updatedAt)];
    if (m) {
      m.donations += 1;
      m.kg += p.estimatedWeightKg || 0;
    }
    for (const t of p.foodTypes || []) foodTypes[t] = (foodTypes[t] || 0) + 1;
    const [id, name] = req.user.isFoodbank ? [p.donorId, p.fromRestaurantName] : [p.claimedBy, p.claimedByName];
    const key = String(id);
    partners[key] = partners[key] || { name: name || "Unknown", donations: 0 };
    partners[key].donations += 1;
  }
  months.forEach((m) => { m.kg = Math.round(m.kg * 10) / 10; });

  return res.status(200).json({
    role: req.user.isFoodbank ? "foodbank" : "restaurant",
    donations: postings.length,
    totalKg: Math.round(totalKg * 10) / 10,
    estimatedMeals: Math.round(totalKg / KG_PER_MEAL),
    donationsWithoutWeight: withoutWeight,
    kgPerMeal: KG_PER_MEAL,
    months,
    foodTypes,
    partnerCount: Object.keys(partners).length,
    topPartners: Object.values(partners).sort((a, b) => b.donations - a.donations).slice(0, 5),
  });
};

const csvCell = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  // Quote everything, and stop spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

// GET /impact/donations.csv — every completed donation, for the user's records.
const exportDonations = async (req, res) => {
  const postings = await mongoFoodPostings.find(completedFilter(req.user)).sort({ pickedUpAt: -1 }).lean();
  const banks = await mongoUsers.find({ _id: { $in: postings.map((p) => p.claimedBy).filter(Boolean) } }, "charitableTaxNum").lean();
  const charityNum = Object.fromEntries(banks.map((b) => [String(b._id), b.charitableTaxNum || ""]));
  const rows = [
    ["Record number", "Picked up", "Pickup window", "Restaurant", "Pickup address", "Food bank", "Food bank charitable registration #", "Food types", "Quantity", "Estimated weight (kg)"],
    ...postings.map((p) => [
      receiptNumber(p._id),
      (p.pickedUpAt || p.updatedAt).toISOString(),
      formatWindow(p),
      p.fromRestaurantName,
      p.fromRestaurantAddress,
      p.claimedByName,
      charityNum[String(p.claimedBy)] || "",
      (p.foodTypes || []).join("; "),
      p.quantity || "",
      p.estimatedWeightKg || "",
    ]),
  ];
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="ladle-donations.csv"');
  return res.send(rows.map((r) => r.map(csvCell).join(",")).join("\r\n"));
};

const receiptNumber = (id) => `LD-${String(id).slice(-8).toUpperCase()}`;

// GET /posting/:id/receipt — a record of one completed donation, for the
// restaurant that gave it or the food bank that collected it.
const getReceipt = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ msg: "Donation not found." });
  const posting = await mongoFoodPostings.findById(req.params.id).lean();
  if (!posting) return res.status(404).json({ msg: "Donation not found." });
  const isParty = [posting.donorId, posting.claimedBy].some((id) => id && String(id) === req.user.id);
  if (!isParty) return res.status(403).json({ msg: "Only the restaurant and the food bank can see this record." });
  if (posting.status !== "picked_up") {
    return res.status(409).json({ msg: "A donation record is available once the food has been picked up." });
  }
  const [donor, bank] = await Promise.all([
    mongoUsers.findById(posting.donorId, "name address phoneNumber email").lean(),
    mongoUsers.findById(posting.claimedBy, "name address phoneNumber email charitableTaxNum verificationStatus").lean(),
  ]);
  const party = (u, fallbackName) => ({
    name: (u && u.name) || fallbackName,
    address: (u && u.address) || "",
    phoneNumber: (u && u.phoneNumber) || "",
    email: (u && u.email) || "",
  });
  return res.status(200).json({
    receiptNumber: receiptNumber(posting._id),
    pickedUpAt: posting.pickedUpAt,
    pickupWindow: formatWindow(posting),
    pickupAddress: posting.fromRestaurantAddress,
    donor: party(donor, posting.fromRestaurantName),
    recipient: {
      ...party(bank, posting.claimedByName),
      charitableTaxNum: (bank && bank.charitableTaxNum) || "",
      verified: Boolean(bank && bank.verificationStatus === "verified"),
    },
    food: {
      foodTypes: posting.foodTypes || [],
      quantity: posting.quantity || "",
      estimatedWeightKg: posting.estimatedWeightKg || null,
      storage: posting.storage || "ambient",
      allergens: posting.allergens || [],
      notes: posting.notes || "",
    },
  });
};

module.exports = { getImpact, exportDonations, getReceipt, KG_PER_MEAL };
