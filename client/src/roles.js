// Account roles. Older sessions only carry isFoodbank, so fall back to it.
export const roleOf = (user) => (user ? user.role || (user.isFoodbank ? "foodbank" : "restaurant") : null);

export const ROLE_LABELS = { restaurant: "Restaurant", foodbank: "Food bank", driver: "Volunteer driver" };

// What "home" is called for each role.
export const HOME_LABELS = { restaurant: "Postings", foodbank: "Pickups", driver: "Deliveries" };

export const VEHICLES = {
  bike: "Bike or cargo bike",
  car: "Car",
  suv_van: "SUV or van",
  truck: "Truck",
};
