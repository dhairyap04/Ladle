**Analysis approach.** I read every tracked source file in `server/` (Express/Mongoose API) and `client/src/` (React SPA), the README, and the six UI screenshots committed at the repo root (`landing.png`, `signup.png`, `main.png`, `create.jpg`, `personalInfo.jpg`, `viewPost.png`). I ran the client through Create React App's own ESLint config and tried a production build. I did not run the API server, because it needs a MongoDB connection and I chose not to use the credentials embedded in the source. Runtime behavior is inferred from code plus screenshots; where a claim depends on something I couldn't execute, it is marked as an **assumption**. Competitor details come from general public knowledge and were not checked live.

---

# Repository Audit Report: MealDrop

## 1. Scope, Vision & Value Proposition

**What it is.** MealDrop is a hackathon-built (README says "within 24 hours", team of 3) MERN web app that connects **restaurants with surplus food** to **food banks** that can collect it. Restaurants post the pickup address, a pickup window and notes. Food banks browse postings in a list and on a Google Map, open a posting, and press "I can pick this up".

**Problem.** Food waste at the restaurant level, set against food insecurity (README cites the 30–40% US food-supply waste figure). In practice, small restaurants have no easy channel to offer one-off surplus, and food banks have no visibility into it.

**Value proposition (as built).** It's free and fast: a "posting within minutes" and a shared map of available pickups. The README roadmap adds delivery (Uber integration, volunteer drivers).

**Reality check.** The concept is clear and worthwhile. The current build is a **demo-grade prototype**: the core "restaurant posts → food bank claims" loop is broken in several places (see §5). The default map center (Edmonton) and the "Province" and "Charitable Org. #" fields show it is scoped implicitly to Canada and Alberta.

## 2. Target Audience

| Persona | Role in app | Goals | Pain points today |
|---|---|---|---|
| **Primary — Restaurant / café manager ("Donor")** | Creates postings | Offload surplus in under 2 minutes during a busy shift; avoid liability; ideally get a tax receipt and recognition | Can't currently sign up as a non-food-bank (see §5). The time format is confusing. Gets no confirmation that anyone claimed the food. |
| **Primary — Food bank / shelter coordinator ("Recipient")** | Browses and claims | Find nearby, suitable food (type, quantity, allergens) that fits their pickup capacity and hours | Postings have no food description, quantity or expiry. Claiming deletes the posting, leaving no record or contact with the donor. No distance filter. |
| **Secondary — Volunteer driver** | Planned (README "Beta") | Pick up and drop off on behalf of food banks | Not implemented; only "Coming soon!" alerts in `ViewPost.js:72-73`. |
| **Secondary — Program admin / city or NGO partner** | Not modelled | Verify organizations, measure impact (kg diverted, meals) | No admin role, verification or reporting. |

## 3. Competitive Landscape

*These are from general public knowledge, not checked live; confirm current offerings before using them externally.*

| Competitor | What It Does Well | Differentiate / Align |
|---|---|---|
| **Too Good To Go** (consumer surplus marketplace) | Polished mobile UX. Very low-friction listing for businesses. Strong brand around food waste. | **Differentiate:** MealDrop is B2Nonprofit and free, not discounted consumer sales. **Align:** borrow its simple listing flow (one-tap recurring listings, pickup windows as a time picker). |
| **Olio** (community and business surplus sharing) | Volunteer network that collects surplus from businesses. Gives impact stats to donors. | **Align:** the volunteer-driver persona in the README roadmap is Olio's model; impact reporting is table stakes. |
| **Food Rescue US** (volunteer-driven rescue app) | Matches donors, receiving agencies and volunteer drivers. Scheduled, recurring rescues. | **Align:** the posting → claim → pickup → delivered status flow and driver dispatch. **Differentiate:** ad-hoc same-day surplus focus. |
| **Second Harvest FoodRescue.ca** (Canadian donor ↔ non-profit platform) | National Canadian network. Donor onboarding. Charitable-org verification. | The most direct competitor for a Canada-scoped app. **Differentiate:** hyper-local, map-first, very low onboarding friction for small independents. **Align:** verifying recipient organizations. |
| **Copia** (B2B surplus donation logistics, US) | Handles logistics end to end. Tax-deduction documentation. Impact analytics for enterprise donors. | **Align:** donation receipts and impact dashboards give donors a reason to come back. Don't compete on logistics depth early. |

**Positioning opportunity:** a free, map-first, "post in 60 seconds" tool for small independent restaurants and community food programs in one metro area, with simple impact receipts. That segment is underserved by enterprise tools like Copia and by consumer tools like Too Good To Go.

## 4. Design Decisions & Architecture

**Stack.** React 17 + MUI 5 + React Router 5 on Create React App 5 (`client/package.json`). The API is Express 4 + Mongoose 6 + JWT in httpOnly cookies (`server/package.json`). MongoDB Atlas holds the data. The Google Maps JS API (`google-map-react`) draws the map, and Geocoding (`react-geocode`) runs client-side. Per the README it was hosted on Heroku. **Assumption:** that deployment is no longer live, since Heroku retired free dynos in late 2022.

**Structure.**
```
server/  index.js → routes/RouteController.js → {UserRoutes, PostingsRoutes} → controllers/* → models/{Users,Postings}
client/  App.js (6 routes) → components/<Page>/<Page>.js + .css, Shared/AddressContainer
```

| Decision | Assessment |
|---|---|
| MERN monorepo with separate `client/` and `server/` | ✅ Reasonable for the scope. ⚠️ No root workspace or scripts, and the root `package-lock.json` is an empty stub. |
| Router-per-resource (`RouteController.js`) | ✅ Clean and extensible, as the README claims. |
| JWT access + refresh tokens in httpOnly cookies (`authHelper.js`) | ✅ A good instinct: tokens aren't readable from JS. ❌ Both signing secrets are **hard-coded string literals** (`authHelper.js:4-5`, with a "MOVE TO .env" TODO). ❌ The refresh cookie `maxAge: 1.577e7` is in **milliseconds**, so it lasts ≈4.4 hours, not "6 months" or the "200 days" the README claims (`UserController.js:29,97`). ❌ Cookies don't set `secure` or `sameSite`. |
| Passwords | ❌ **Stored and compared in plaintext** (`Users.js` `password: String`; `UserController.js:85` `user.password != password`). |
| DB connection | ❌ `index.js:24` falls back to **hard-coded Atlas credentials** when env vars are missing. They're in git history and must be rotated (values not reproduced here). |
| CORS | ⚠️ `cors({ origin: true, credentials: true })` reflects *any* origin and allows credentials. Use an allowlist. |
| Authorization | ❌ Authentication only, with no ownership or role checks. `POST /posting/delete` has **no auth at all** (`PostingsRoutes.js:9`), so anyone can delete any posting by ID. That contradicts the README's "no outside user can manipulate another user's data". |
| Data model (`Postings.js`) | ⚠️ Too thin for the domain: no food description, quantity, allergens, pickup **date**, expiry or status, and no `restaurantId` reference (only a name string). `toFoodbankName`, `toFoodbankAddress` and `deliveryMethod` are never written. `updatedAt` is never updated (use `{ timestamps: true }`). There's a typo, `unqiue`. |
| Data model (`Users.js`) | ⚠️ One collection with an `isFoodbank` boolean is fine for two roles, but it's never enforced. `charitableTaxNum` has `unique: true` without `sparse`, so it likely allows only one user *without* a tax number (see §5). |
| "Claim" = hard delete (`deleteOnePost`) | ❌ Loses all history and can't support notifications, impact metrics, receipts or disputes. Use a status state machine instead. |
| Geocoding on the client on every page load (`MainPage.js:63-75`) | ⚠️ N API calls per visit (cost, quota, latency), `forceUpdate` with mutated arrays, region bias set to `"es"` (Spain) (`MainPage.js:21`). Geocode once on the server at create time and store GeoJSON with a `2dsphere` index, which also enables "near me" queries. |
| Validation and error handling | ❌ Ad hoc. `getOnePost` with a malformed ID throws a CastError that Express 4 doesn't catch, so the request hangs. `updateUser` can send two responses (`.catch` returns a 400, then the code continues to a 200). |
| Front-end patterns | ⚠️ A mix of class and function components. `onChange` handlers read the **implicit global `event`** (14 ESLint *errors*, `no-restricted-globals`). Many inline styles. No shared layout, header or theme; `Header.js` is unused. |
| Tooling and supply chain | ❌ **No tests and no CI** (`.github/` exists but is empty). `server/.gitignore` ignores its lockfile. The client lockfile is locally modified. A fresh `react-scripts build` **crashes** (`MiniCssExtractPlugin is not a constructor`, a known CRA 5 + mini-css-extract-plugin 2.5.0 incompatibility). CRA itself is deprecated. `jsonwebtoken@^8` and `axios@^0.24` are old majors with published advisories; run `npm audit` to confirm. |

**Verdict.** The overall shape (REST API, cookie JWT, document DB, map UI) suits the product. Security, the data model and the claim workflow need rework before any real-world pilot.

## 5. Feature Inventory & Verification

Legend: ✅ works as intended (from code) · ⚠️ partially works / has defects · ❌ broken or not implemented · 🔍 assumption

| Feature | Expected Behavior | Verified? | Notes |
|---|---|---|---|
| Landing page | Explain product; route to auth or guest browse | ⚠️ | Renders (`landing.png`). The `<Button><Link>` nesting (`LandingPage.js:14-19`) means **only the text label is clickable**; clicking the button's padding does nothing. Copy typo: "can creating a posting". |
| Sign up — food bank | Create account, set cookies, go to profile | ⚠️ 🔍 | Works when `isFoodbank: true`. **Likely** fails for the second user who has no charitable number, because of the non-sparse unique index on `charitableTaxNum` (depends on Mongoose having built the index). |
| Sign up — restaurant | Same, as a non-food-bank | ❌ | `UserController.js:7` rejects with 400 when `!userInfo.isFoodbank`, so `false` (the default "No") is **always rejected**. Restaurants, the primary donors, cannot register. Consistent with `create.jpg` showing "Welcome Food Bank!" creating a posting. |
| Log in | Validate credentials, set cookies | ✅ | Works (plaintext comparison). Distinct error messages for unknown email and wrong password allow account enumeration. |
| Session refresh | Silently renew access token for long sessions | ⚠️ | The logic in `verify()` is sound, but the refresh cookie expires after ≈4.4 h (ms/seconds mix-up). |
| Log out | End session | ❌ | API route exists (`/user/logout`); **no UI anywhere** calls it. |
| Already-logged-in check on `/auth` | Redirect authenticated users | ⚠️ | Shows `alert("You're already logged in!")` but leaves the user on the form. |
| Browse postings (list) | Show all open postings | ⚠️ | Works when postings exist (`main.png`). Postings are never filtered by date, so stale ones remain forever. |
| Empty state / first posting | Allow creating a posting when none exist | ❌ | The "Create a Posting" button is inside `{postings.length !== 0 && …}` (`MainPage.js:104-107`). With zero postings the page is blank and **no one can create the first posting** through the UI. |
| Map of postings | Pin each posting | ⚠️ | Works with a valid API key. Client-side geocoding per load, Spain region bias, fixed Edmonton center with no `fitBounds`. A failed geocode (`res.results[0]` undefined) throws an uncaught error inside the promise. |
| Create posting | Restaurant submits address, window, notes | ❌ | (1) The labels say "HH:MM" but the schema field is `Number` 0–2400, so "20:00" (exactly what `create.jpg` shows) fails the Mongoose cast with a 400 the user never sees (`console.log` only). (2) The list isn't refetched after success. (3) The button shows for guests and food banks; there's no role check on client or server. (4) There's no required-field indication. |
| Pickup time display | Show a human-readable window | ⚠️ | `tConvert` (`PostingTile.js:9-22`) shows 1200 as "12:00 AM", 30 as "3:0 AM", 1230 as "3:0 PM", and 2400 as "12:00 PM". |
| View posting | Detail page with map | ⚠️ | Works (`viewPost.png`). "Pickup Date" actually shows `updatedAt`, which is the creation date. A malformed ID makes the request hang server-side. Uses a hard-coded `../images/logo.png` path. |
| Claim ("I can pick this up") | Food bank reserves pickup; donor notified | ⚠️ | **Deletes the posting** with no auth, no confirmation, no role check and no record of who claimed it. Navigates to `/confirmed` even for guests. |
| Order-confirmed page | Acknowledge claim | ✅ | Works. Uses a hot-linked third-party GIF (`ConfirmOrder.js:11`). It says "Delivery confirmed!" although nothing was delivered. |
| Profile update | Edit org details | ❌ | It doesn't load existing data (`/user/info` is never called), and it sends **all fields, including empty strings**, so saving one field wipes the others (e.g. `name: ""`). The server accepts arbitrary fields (mass assignment, including `password` and `isFoodbank`). Errors go only to the console. Guests can reach it through "Manage Personal Info". |
| `GET /user/info` | Return the current user's profile | ⚠️ | Returns the full document **including the password**. Unused by the client. |
| Edit posting | Donor edits own posting | ❌ | Empty stub (`PostingsController.js:26-28`); no route. |
| Delete own posting | Donor withdraws a posting | ❌ | Only the unauthenticated delete used by "claim". |
| Uber delivery / own drivers | Delivery options | ❌ | Placeholder `alert("Coming soon!")` buttons. |
| Automated tests | — | ❌ | None. The `test` script exists but there are no test files. |
| Production build | `npm run build` succeeds | ❌ | Crashed locally on a dependency incompatibility. Even after fixing that, the 14 ESLint errors (`no-restricted-globals`) will **likely** fail CRA's production build. |

## 6. UI Evaluation — Nielsen's 10 Heuristics

| # | Heuristic | Rating (Pass/Partial/Fail) | Evidence & Notes |
|---|---|---|---|
| 1 | Visibility of system status | **Fail** | Only `ViewPost` shows "Loading...". Create posting and profile update give no progress or success feedback, and failures go to `console.log` (`CreatePosting.js:50`, `ProfilePage.js:54`). Nothing shows a posting's status (open or claimed). The main page doesn't show whether you're logged in except in the "Welcome" text. |
| 2 | Match between system and real world | **Partial** | Domain language is good ("Pickup Notes", "I can pick this up"). But "Pickup Date" shows the creation date. Times are labelled HH:MM yet must be typed as `1430`. "Delivery confirmed!" after a claim misstates what happened. Address fields assume Canada ("Province"). |
| 3 | User control and freedom | **Fail** | Claiming permanently deletes a posting with no confirmation or undo. Donors can't edit or withdraw postings. No logout. The modal close is mouse-only (`<img onClick>`); there's no Esc key and no backdrop-click close. |
| 4 | Consistency and standards | **Partial** | Three different outlined-button styles (grey on Landing, MUI blue on Main, black on ViewPost). A purple secondary button appears only on Auth. Three font stacks (Arial in `.container`, system UI on Landing and ViewPost, Roboto from MUI). A Back button exists only on ViewPost. The logo goes to `/main` but there's no other navigation. |
| 5 | Error prevention | **Fail** | Free-text time fields, `noValidate` on the auth form, no required markers on Create Posting, guests can open Create Posting and Profile, no role gating. Partial profile edits silently blank other fields. |
| 6 | Recognition rather than recall | **Partial** | Labelled fields and map pins help. But users must recall the hidden time format. The profile shows no current values. The donor's saved address isn't reused when posting. Tiles lack what the food *is*, so users must open each posting. |
| 7 | Flexibility and efficiency of use | **Fail** | No search, filter or sort (by distance, time window or food type). No recurring postings. No address prefill. No keyboard support on the modal. Every posting is re-geocoded on every page load. |
| 8 | Aesthetic and minimalist design | **Partial** | Main, ViewPost and Profile are clean and uncluttered (`main.png`, `viewPost.png`). On Landing, bold body text sits over a dense patterned background (`landing.png`), which hurts legibility. On ViewPost, two non-functional "Beta" buttons have the same visual weight as the primary action. |
| 9 | Help users recognize, diagnose, recover from errors | **Fail** | Errors appear as browser `alert()` with raw server strings ("Mongo Create User Failed", `AuthPage.js:48`) or `alert(err.response)`, which prints `[object Object]` (`ViewPost.js:36,46`). No inline field errors and no recovery guidance. |
| 10 | Help and documentation | **Fail** | Only the landing paragraph. No onboarding for either role, no FAQ (food-safety or liability questions donors will have), no tooltips. |

## 7. UI Evaluation — CRAP Principles

| Principle | Observations | Rating |
|---|---|---|
| **Contrast** | Primary CTAs (MUI blue, filled) stand out well on Main and Create. Tile text `#575757` on `#EFEFEF` is readable. Weak points: on ViewPost the black "Schedule Uber Delivery (Beta)" button competes with the primary blue button. Page titles on Profile and ViewPost use 24px at regular weight, so the hierarchy is flat. Landing body copy is bold grey over a busy pattern. The Auth "toggle" is a full-width purple filled button, as prominent as the submit button, when it should be a text link. | Partial |
| **Repetition** | A recurring header pattern (logo + title/subtitle) on Main, Profile and ViewPost, and consistent grey rounded cards for tiles and the ViewPost info panel, give some unity. It's undercut by inconsistent fonts and button styles (§6 #4), many inline style overrides, and no shared theme or header component (`Header.js` unused). | Partial |
| **Alignment** | Main and ViewPost use a clear two-column (49%/49%) grid aligned to the header edges. On Profile, the left column's "Charitable Org. #" field sits out of line with the right column's rows (`personalInfo.jpg`). In the Create modal the Create button is 25% wide and left-aligned under an uneven two-column form, with dead space below Notes (`create.jpg`). The class `flew-column` (typo, `ViewPost.js:94`) is a no-op, so that block's intended alignment doesn't apply. No responsive breakpoints exist anywhere, so the fixed % widths break on mobile. | Partial |
| **Proximity** | Good: the address fields are grouped tightly under "Pickup Address", and tile metadata is grouped next to its icon. Weak: on ViewPost the destructive primary action sits in one undifferentiated stack with two beta actions. On Profile, org identity, contact and hours fields are mixed across columns with no section headings. The Auth role question ("Are you a food bank?") is a bare label rather than a grouped, explained choice. | Partial |

## 8. Prioritized Improvements

### High Priority

1. **Fix the broken core loop.** Restaurants can't sign up (`UserController.js:7` should check `typeof isFoodbank !== 'boolean'`). The first posting can't be created (move the Create button outside the `postings.length` guard and add an empty state). Time entry fails (use MUI `TimePicker` or `<input type="time">` and convert to minutes or a `Date`). The list doesn't refresh after create (call `getPostings()` in the modal's success callback). *Why:* the donor → recipient flow doesn't work end to end today.
2. **Secure credentials and auth.** Rotate the database user whose password is in git history. Move DB credentials and JWT secrets to environment variables and fail fast if they're missing. Hash passwords with bcrypt or argon2. Remove `password` from `/user/info` (`.select('-password')`). Whitelist updatable fields in `updateUser`. Set `secure` and `sameSite` on cookies and fix the refresh `maxAge` units. Replace `origin: true` with an allowlist. *Why:* plaintext passwords and leaked secrets rule out any real pilot.
3. **Add authorization and replace "claim = delete" with a status workflow.** Add `status: open | claimed | picked_up | expired | cancelled`, `donorId`, `claimedBy`, `claimedAt`. Require `verify` plus role checks (only donors create and edit; only food banks claim; only the owner withdraws). Add a confirmation dialog before claiming. *Why:* it closes the unauthenticated delete and is the foundation for notifications, history and impact metrics.
4. **Make the client build again and lock dependencies.** Commit lockfiles (remove `package-lock.json` from `server/.gitignore`, delete the root stub). Replace global `event` with `(e) => …e.target.value` (14 errors). Migrate CRA to Vite. Upgrade `jsonwebtoken` to v9+ and `axios` to v1.x, then run `npm audit`. *Why:* the project can't currently be built from a clean checkout.

### Medium Priority

5. **Fix profile editing.** Load current values from `/user/info` into controlled inputs and send only changed fields. Show success or error feedback. Redirect guests to `/auth`. *Why:* saving currently wipes data.
6. **Enrich the posting model.** Add food description, category, quantity/servings, allergens and dietary tags, prepared-at or best-before, and pickup date (not `updatedAt`). Add `{ timestamps: true }` and remove unused fields. *Why:* food banks need these to decide whether to claim, and food safety requires them.
7. **Move geocoding to the server.** Geocode on create, store a GeoJSON `location` with a `2dsphere` index, and expose `GET /posting/near?lat&lng&radius`. Fit the map to markers and drop the `"es"` region. *Why:* lower API cost, faster loads, and it enables distance search.
8. **Feedback and error UX.** Replace `alert()` and `console.log` with MUI `Snackbar` or `Alert` and inline `TextField` `error`/`helperText`. Add loading spinners and skeletons, and fix `tConvert`. *Why:* this fixes Nielsen #1 and #9.
9. **Role-aware navigation shell.** A shared `AppBar` with logo, role badge, nav and a Logout button. Hide Create for non-donors and guests. Redirect from `/auth` if already authenticated. *Why:* consistency (#4) and control (#3).
10. **Tests and CI.** API tests with `supertest` + `mongodb-memory-server` (auth, create, claim, authorization); React Testing Library for the Auth and Create forms; a GitHub Actions workflow in the existing empty `.github/`. *Why:* none of the defects above would have survived basic tests.

### Low Priority

11. **Responsive layout and accessibility.** MUI `Grid`/`Stack` with breakpoints; `alt` text on all `<img>` (5 lint warnings); make the modal an MUI `Dialog` (focus trap, Esc); fix `<Button><Link>` nesting with `component={Link}`. *Why:* restaurant staff will mostly use phones.
12. **Visual system.** One MUI theme (palette, typography, button variants). Remove inline styles. Fix the `flew-column` typo. Set the page `<title>` (currently "React App"), favicon and manifest; `index.html` references files that don't exist. *Why:* CRAP repetition and contrast.
13. **Clean up dead code and assets.** Remove `Header.js`, the `editPosting` stub, unused imports and debug `console.log`s. Self-host the hot-linked GIF and SVG (`ConfirmOrder.js:11`, `PostingTile.js:43`). Confirm the licence for `public/images/background.svg` (faint stamp-like marks are visible in `landing.png`; **assumption** that they may be a stock watermark). Add a `LICENSE` file, since `package.json` says ISC but none exists. *Why:* maintainability and licensing hygiene (not legal advice).
14. **Landing copy and hierarchy.** Fix "can creating". Use a single primary CTA plus a secondary one, and add role-specific value statements ("For restaurants" / "For food banks").

## 9. Future Feature Recommendations

| Feature | User Need Addressed | Rationale | Effort (S/M/L) |
|---|---|---|---|
| **Claim notifications (email/SMS/web push)** | Donors need to know someone is coming; food banks want alerts for new nearby postings | Same-day surplus is time-critical, and polling a map doesn't scale. Pairs with the status workflow (High #3). | M |
| **Distance and filter search** ("within 5 km, pickup before 9 pm, no nuts") | Recipients want relevant, reachable food | Builds on the server-side geo index; standard on comparable platforms. | M |
| **Recurring / scheduled donations** | Restaurants with predictable surplus (e.g. nightly bakery leftovers) | Turns one-off postings into reliable supply, which food banks value most. | M |
| **Impact dashboard and donation receipts** | Donors want recognition and documentation; programs need reporting | Copia and Olio-style impact stats drive retention. Canadian charitable receipting fits the existing `charitableTaxNum` field. | M |
| **Recipient verification and admin console** | Donors need trust that food goes to legitimate organizations | Validate charitable numbers and approve accounts; reduces abuse of free food. | M |
| **Food-safety fields and photos** | Recipients must assess suitability; donors want liability clarity | Allergens, temperature-control flag, prepared-at time and a photo. Low effort, high trust. | S |
| **Recipient profile: capacity, accepted food types, hours** | Avoid offering food a recipient can't take or store | Enables smart matching and fewer failed pickups. | S |
| **In-app messaging per posting** | Coordinate loading-dock details, delays and quantities | Notes alone are one-way; phone numbers aren't shown anywhere today. | M |
| **Volunteer driver role and dispatch** (README roadmap) | Food banks without vehicles or staff | The README's stated next step and the core of Food Rescue US's model; do it after the status workflow exists. Third-party courier integration can come later. | L |
| **Mobile-first PWA** | Restaurant staff post from phones mid-shift | Installable, offline-tolerant, push-capable, without building native apps. | M |
| **Reliability signals** (no-show tracking, ratings) | Donors need confidence a claim leads to a pickup | Discourages claim-and-ghost, which wastes the food entirely. | S |

## 10. Assumptions & Limitations

- **Server not run.** The API needs a MongoDB connection; I didn't use the credentials embedded in source. Server behavior is inferred from code.
- **Client build attempted.** `react-scripts build` crashed on a dependency incompatibility (`mini-css-extract-plugin` 2.5.0) in the locally installed `node_modules`. The ESLint findings come from running CRA's own `eslint-config-react-app`. That those lint errors would also fail a fixed build is a **likely** outcome based on CRA's defaults, not observed.
- **UI evaluated from the repo's own screenshots** (dated January 2022) plus code. There was no live deployment to test; the README's Heroku host is **assumed** to be offline. Responsive and mobile behavior was judged from CSS only.
- **`charitableTaxNum` unique-index failure** assumes Mongoose built the index (its default `autoIndex` behavior).
- **Competitor descriptions** come from general public knowledge, not live research; confirm before external use.
- **Dependency advisories** (jsonwebtoken < 9, axios < 1.x) are noted at a general level; run `npm audit` for the authoritative list.
- **Secrets** found in the repo (DB credentials, JWT signing strings) are described only abstractly and not reproduced.
- **Background image licensing** (possible watermark) is an observation, not a determination.
