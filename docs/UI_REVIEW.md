# Ladle UI review — November 2026

A pass over every page as each kind of user (guest, restaurant, food bank, volunteer driver and admin), at desktop (1280 px) and phone (375 px) widths. It covers the app after the volunteer driver and reliability features were added.

## How it was reviewed

- **Data:** a local API on an in-memory database, seeded with a restaurant (with a photo posting, a refrigerated posting, a completed and rated pickup, and a weekly donation), a food bank waiting for verification, a volunteer driver with an accepted delivery, and an admin.
- **Walkthrough:** each page was opened and read as that user, and the main flows were clicked through: claim, request a driver, accept, collect, deliver, then rate.
- **Automated checks:** a small script run on each page looked for images without alt text, controls and form fields without an accessible name, heading order, text contrast against WCAG AA, and horizontal overflow. (axe-core couldn't be loaded into the page in this environment, so the script covers the same basic checks.)
- **Judged against:** Nielsen's usability heuristics and WCAG 2.1 AA.

## Findings and fixes

| # | Where | Problem | Heuristic / guideline | Fix |
|---|---|---|---|---|
| 1 | Landing chip, "Step 1" labels, stars and food-type icons | The dark tangerine text (`#B85A08`) measured 4.1:1 on the peach tint and 4.4:1 on cream, below the 4.5:1 AA minimum. | WCAG 1.4.3 Contrast | Darkened to `#A34F06` everywhere: 5.0:1 on tint, 5.3:1 on cream, 5.7:1 on white. |
| 2 | Profile (all roles) | The form rendered empty and disabled, then filled in, so MUI's floating labels stayed on top of the values ("Name" over the name). | Aesthetic and minimalist design; legibility | Fields now render once the profile has loaded, with a placeholder until then. |
| 3 | Profile | "Save" jumped straight to the home page, so there was no sign the save worked or what changed. | Visibility of system status | The page stays put, shows a "Profile saved" message, and refreshes from what the server stored. Says "There's nothing new to save" when nothing changed. |
| 4 | Posting page (food bank) | With a volunteer driver already on the way, the food bank still saw "Collect it during the pickup window" and a big "Mark as picked up" button. | Match between system and the real world; error prevention | When a driver has accepted or collected the food, the food bank sees "Sam Rivera is bringing this food to your food bank", with a quieter "We collected it ourselves instead". |
| 5 | Restaurant's own postings | Every card was titled with the restaurant's own name, so the list was a column of identical titles. | Recognition rather than recall | A restaurant's own cards are titled by the food ("3 trays of bread"). |
| 6 | Reliability badges, admin | "1 pickups", "0 deliverys", "Rescued (1 pickups)". | Consistency and standards | Shared `plural()` helper, with "delivery" → "deliveries". |
| 7 | Posting page | The delivery card had no heading, so its purpose wasn't clear at a glance and screen reader users couldn't jump to it. | Recognition; WCAG 2.4.6 Headings | Titled "Volunteer delivery" (h2). |
| 8 | Admin console | "Restaurants · 1 drivers" crammed two numbers into one tile. | Aesthetic and minimalist design | Separate "Volunteer drivers" tile. |
| 9 | Unknown URLs | Showed a blank page under the header. | Help users recognise and recover from errors | A "We couldn't find that page" page with a way home. |
| 10 | Every page | The browser tab always said "Ladle", so tabs, history and screen readers couldn't tell pages apart. | WCAG 2.4.2 Page Titled | Per-page titles, e.g. "Your impact · Ladle", or the restaurant's name on a posting. |
| 11 | Every page | No way for keyboard users to skip past the header navigation. | WCAG 2.4.1 Bypass Blocks | A "Skip to content" link, visible on focus, that moves focus to the page's main region. |

## Checked and fine

- **Text alternatives:** no images without alt text. Decorative illustrations use empty alt; posting photos and the logo link have names.
- **Controls and forms:** every visible button, link and form field has an accessible name. The only hits were MUI's hidden native select inputs, which are `aria-hidden`; their labelled comboboxes are what assistive tech uses.
- **Headings:** one h1 per page, with no skipped levels.
- **Layout:** no horizontal scrolling at 375 px. The bottom navigation and safe-area padding work.
- **Confirmation:** every irreversible action asks first: claim, withdraw, release, report a no-show, accept, collect, deliver, cancel a driver.
- **Status:** status is always shown in words as well as colour (status chips, the delivery status, reliability flags).

## Known gaps, not fixed in this pass

- **Main page title flicker:** while the account is still loading, the main page briefly renders the postings view (and title) before switching to the driver home.
- **Empty map panel:** without a Google Maps key the map area shows a large "Map unavailable" panel. That resolves once the real key is added.
- **Narrow-screen rating stars:** the star control is MUI's standard `Rating`, which is keyboard and screen reader accessible, but its targets are tight on small phones.
