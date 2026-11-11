# MealDrop

MealDrop connects restaurants that have surplus food with food banks that can collect it. Restaurants post what they have and when it can be picked up; food banks see nearby postings on a list and a map, claim one, and mark it collected.

MealDrop is designed, built and maintained by **Dhairya Prajapati**. Development started in **February 2026** and is ongoing.

## Why

In the United States, an estimated **30 to 40 percent** of the food supply is wasted, while millions of households don't have reliable access to enough food. Restaurants regularly end a shift with good food they can't sell, and small restaurants rarely have an easy way to offer it to someone who can use it. MealDrop aims to make donating that food take a couple of minutes.

## What it does

- **Restaurants** sign up, post the pickup address, date and time window, and add notes about the food. They can edit or withdraw a posting while it's still open.
- **Food banks** browse open postings in a list and on a map, claim one (only one food bank can claim each posting), and mark it picked up once they've collected it.
- Each account has a "Your postings" or "Your pickups" list, so both sides can see where every donation stands: open, claimed, picked up, expired or withdrawn.
- Postings expire automatically when their pickup window ends.

## How it's built

- **Client:** React with Material UI, built with Vite. Google Maps JavaScript API and Geocoding show posting locations on a map.
- **Server:** Node.js and Express REST API with a MongoDB database (Mongoose).
- **Auth:** passwords are hashed with bcrypt; sessions use short-lived JWT access tokens and refresh tokens stored in httpOnly cookies.
- **Access control:** only restaurants can create, edit or withdraw postings, only food banks can claim them, and each user can only change their own data.

## Running locally

1. **Server:** copy `server/.env.example` to `server/.env` and fill in `MONGO_URI`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. The server won't start without them. Then run `cd server && npm install && npm start`.
2. **Client:** create `client/.env` with `REACT_APP_HOST_URL=http://localhost:5000/` (keep the trailing slash) and `REACT_APP_GCP_KEY=<your Google Maps key>`. Then run `cd client && npm install && npm start` (Vite dev server on http://localhost:3000). `npm run build` writes the production bundle to `client/build/`, and `npm run lint` runs ESLint.

## Roadmap

- Richer postings: food type, quantity, allergens and photos.
- Notifications when a posting is claimed or about to expire.
- Distance filtering and "near me" search.
- Volunteer drivers who can collect food on a food bank's behalf.
- Impact reports and donation receipts for restaurants.

See [AUDIT_REPORT.md](AUDIT_REPORT.md) for the full list of planned improvements.
