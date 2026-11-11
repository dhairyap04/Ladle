<p align="center"><img src="client/public/images/logo-mark.svg" width="96" alt="Ladle logo"></p>

# Ladle

Ladle connects restaurants that have surplus food with food banks that can collect it. Restaurants post what they have and when it can be picked up; food banks see nearby postings on a list and a map, claim one, and mark it collected.

Ladle is designed, built and maintained by **Dhairya Prajapati**. Development started in **February 2026** and is ongoing. (It was called MealDrop until November 2026.)

<p align="center"><img src="docs/screenshots/landing.jpg" width="720" alt="Ladle landing page"></p>

## Why

In the United States, an estimated **30 to 40 percent** of the food supply is wasted, while millions of households don't have reliable access to enough food. Restaurants regularly end a shift with good food they can't sell, and small restaurants rarely have an easy way to offer it to someone who can use it. Ladle aims to make donating that food take a couple of minutes.

## What it does

**For restaurants**
- Post surplus food in about a minute: food types, quantity and weight, storage (room temperature, fridge, freezer, hot), when it was prepared, allergens and a photo.
- Set up **weekly donations** (for example, bread every weeknight at 9 PM); Ladle posts them automatically.
- Get notified when a food bank claims and picks up your food, and **message** the food bank about pickup details.
- See your **impact**: donations, kilograms rescued and estimated meals, month by month. Download your records as CSV or print a **donation record** for each pickup.

**For food banks**
- Browse open pickups on a list and a map, and **search by distance**, day, pickup time, food type and allergens to avoid.
- Describe what you can accept (food types, fridge/freezer, maximum weight, receiving days and hours, travel radius). Postings are labelled as a good fit or say why not, and you're **alerted** when suitable food is posted nearby.
- Claim a pickup (only one food bank can claim each posting), ask the restaurant questions first, and mark it picked up once collected.
- Get **verified** by adding your charitable registration number. Restaurants see a verified badge when you claim their food.

**For everyone**
- Notifications under the bell, optional browser alerts, and optional email.
- An **installable app (PWA)** with a phone-friendly bottom navigation bar and an offline notice.
- Postings expire automatically when their pickup window ends.

**For admins**
- An admin console to review food bank verifications (with a link to the CRA charities listing) and see activity across the platform.

## Screenshots

| Sign up | Open pickups |
|---|---|
| <img src="docs/screenshots/sign-up.jpg" alt="Sign-up page with restaurant and food bank role cards"> | <img src="docs/screenshots/pickups.jpg" alt="Food bank view of open pickups and claimed pickups"> |

| Posting details | |
|---|---|
| <img src="docs/screenshots/posting.jpg" alt="Posting details with a status tracker"> | The map shows "Map unavailable" in these screenshots because no Google Maps key was set locally. |

The design direction, competitor research and colour palette are documented in [docs/DESIGN.md](docs/DESIGN.md).

## How it's built

- **Client:** React with Material UI, built with Vite. Google Maps JavaScript API and Geocoding show posting locations on a map.
- **Server:** Node.js and Express REST API with a MongoDB database (Mongoose).
- **Auth:** passwords are hashed with bcrypt; sessions use short-lived JWT access tokens and refresh tokens stored in httpOnly cookies.
- **Access control:** only restaurants can create, edit or withdraw postings, only food banks can claim them, each user can only change their own data, and only admins can verify food banks.
- **PWA:** web app manifest and a service worker (production builds only) that caches the app shell but never API data.

## Running locally

1. **Server:** copy `server/.env.example` to `server/.env` and fill in `MONGO_URI`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. The server won't start without them. Then run `cd server && npm install && npm start`.
2. **Client:** create `client/.env` with `REACT_APP_HOST_URL=http://localhost:5000/` (keep the trailing slash) and `REACT_APP_GCP_KEY=<your Google Maps key>`. Then run `cd client && npm install && npm start` (Vite dev server on http://localhost:3000). `npm run build` writes the production bundle to `client/build/`, and `npm run lint` runs ESLint.
3. **Tests:** `cd server && npm test` runs the API test suite against an in-memory MongoDB (no database or keys needed).

### Optional server settings

| Variable | What it enables |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Geocodes addresses when they're saved, for distance search, distances on cards and new-food alerts by radius. Restrict the key to the Geocoding API. |
| `SMTP_URL`, `EMAIL_FROM` | Emails notifications as well as showing them in the app. |
| `ADMIN_EMAILS` | Comma-separated emails of accounts that get the admin console (applied when they sign up or log in). |
| `REQUIRE_VERIFIED_TO_CLAIM` | `true` lets only verified food banks claim postings. Off by default. |

## Roadmap

- Volunteer drivers who can collect food on a food bank's behalf, with dispatch.
- Reliability signals: no-show tracking and ratings.
- Web push notifications for the installed app.

See [AUDIT_REPORT.md](AUDIT_REPORT.md) for the full list of planned improvements.
