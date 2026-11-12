# Ladle design direction

This document records who Ladle is for, which products it competes with, and how that shaped the visual redesign in November 2026.

## Scope and audience

Ladle is a free web app that connects **restaurants with surplus food** to **food banks** that can collect it. The current build is scoped to Canada (geocoding region, "Province" and "Charitable Registration #" fields, default map centre in Edmonton).

| Who | What they need from the UI |
|---|---|
| **Restaurant / café manager** (donor) | Post surplus in a minute or two at the end of a busy shift, on a phone or a back-office laptop. See whether someone has claimed it. |
| **Food bank / shelter coordinator** (recipient) | Scan what's nearby and *when* it can be collected, claim it with confidence, and keep track of pickups they've committed to. |
| **Guest** (curious donor or funder) | Understand in seconds what Ladle does and which side they're on. |

## Competitors

Researched in November 2026 from public sources (listed at the end). Figures are company-reported and change over time.

| Product | Model | Who uses it | Cost | What it does well |
|---|---|---|---|---|
| **Second Harvest Food Rescue app / FoodRescue.ca** | Donor posts surplus; registered non-profits nearby get an email and claim it | Canadian food businesses and approved social-service agencies | Free | The closest competitor to Ladle: national Canadian reach, screened donors, claim-based flow. Businesses apply to become approved donors first. |
| **Feeding America MealConnect** | Donor posts a photo and pickup details; the platform matches it to a local food bank or pantry | US restaurants, bakeries, grocers; Feeding America network | Free | Photo-first posting, automatic matching, live delivery tracking, donation guidelines in the app. |
| **Food Rescue Hero** (412 Food Rescue) | Volunteer drivers get push alerts for nearby rescues and are navigated from pickup to drop-off | Partner rescue organisations in the US and Canada | Free to volunteers; run by partner orgs | Fast response through push notifications and turn-by-turn pickup logistics. |
| **Replate** | Businesses schedule on-demand or recurring pickups; Replate's rescuers deliver to nearby non-profits | Offices, caterers, chain restaurants (US) | Paid by the business | Recurring scheduling and impact reporting (meals, CO₂, water). |
| **Goodr** | Managed surplus pickup with donation and tax-savings tracking | Large venues, airports, corporate kitchens (US) | Paid (reported as quantity-based monthly fees) | Tax-deduction tracking, insurance and certified handlers. |
| **Too Good To Go** | Consumers buy discounted "Surprise Bags" of surplus from shops and restaurants | Consumers and food businesses (international) | Business earns a share of the sale | Very clear pickup-window display, warm and friendly brand, polished mobile UX. |
| **Flashfood** | Consumers buy discounted near-expiry groceries | Grocery stores and shoppers (Canada, US) | Discounted sales | Simple, deal-focused browsing. |
| **Olio** | Neighbours and volunteers share surplus food locally | Households, volunteers, businesses | Freemium | Community feel, local sharing. |

### Where Ladle fits

- **Same mission, lower friction.** Second Harvest and MealConnect are the direct comparisons: free, donor-to-charity, claim or match based. Ladle's angle is that any small independent restaurant can sign up and post immediately, with a map of what's nearby.
- **Not a marketplace.** Too Good To Go and Flashfood sell surplus to consumers. Ladle gives it to food banks for free, so the tone should be about community and impact, not deals.
- **Not a logistics company (yet).** Replate, Goodr and Food Rescue Hero own the pickup. Ladle leaves pickup to the food bank; volunteer drivers stay on the roadmap.

## What the redesign takes from this

| Lesson | Seen in | What Ladle now does |
|---|---|---|
| Pick your side first | Every competitor has separate donor and recipient onboarding | The landing page has two clear entry points ("I'm a restaurant" / "I'm a food bank"), and sign-up uses two large role cards instead of a yes/no dropdown. |
| The pickup window is the key fact | Too Good To Go, MealConnect | Posting cards lead with the restaurant and a prominent pickup date/time chip. |
| Show where a donation stands | MealConnect live tracking | Each posting shows a Posted → Claimed → Picked up progress tracker, with colour-coded status chips. |
| Show impact | Replate, Goodr | Signed-in users see a count of their completed donations or pickups, from real data only. |
| Warm, human, trustworthy | Too Good To Go, Olio | A green-and-tangerine palette on a soft cream background, a rounded friendly typeface, and original illustrations instead of stock clip art. |
| Works on a phone | All mobile-first competitors | Layouts stack on small screens, and there's a consistent header with sign-out on every page. |

## Name

The app was renamed from **MealDrop** to **Ladle** in November 2026. "Ladle" is one easy-to-say word, it is visual (a ladle is the tool for serving food to others), and it suits community kitchens and food banks without sounding like a discount marketplace. Because the name doesn't describe the service on its own, it's paired with a short tagline where needed, for example *"Ladle: surplus food, picked up."*

Before relying on the name commercially, check the Canadian Trademarks Database (CIPO), domains and app store listings. A November 2026 web search found no established food-rescue product called Ladle, but did find a portfolio page describing a food-rescue marketplace project with that name.

## Visual identity

- **Logo:** a white ladle with three tangerine wisps of steam on a leaf-green circle. The ladle is the tool for serving food to others; the steam says *fresh, still good*. App icons fill the whole square with green so they read well on a home screen.
- **Colours:**
  - Leaf green `#1B6B4A` (primary: trust, sustainability, "go")
  - Deep green `#0F4A32` (headings, dark accents)
  - Tangerine `#F08A24` (accent: food, warmth, highlights)
  - Cream `#FAF7F2` (page background), white surfaces
  - Ink `#1C2420` text and slate `#5B6660` secondary text
  - Status: open = green, claimed = amber, picked up = deep green, expired/withdrawn = grey
- **Type:** Plus Jakarta Sans (Google Fonts), falling back to the system UI font.
- **Imagery:** original SVG illustrations in the brand palette. No third-party stock images or hotlinked GIFs.

## Sources

- [Second Harvest Food Rescue app](https://secondharvest.ca/our-work/food-rescue/second-harvest-food-rescue-app) · [Second Harvest: donate food](https://secondharvest.ca/donate-food/)
- [Feeding America: MealConnect launch](https://feedingamerica.org/about-us/press-room/mealconnect) · [QSR Magazine on MealConnect](https://www.qsrmagazine.com/news/feeding-america-launches-food-donation-platform/)
- [Food Rescue Hero: learn more](https://foodrescuehero.org/learn-more) · [MIT Solve: Food Rescue Hero](https://solve.mit.edu/solutions/50308)
- [Replate on MIT Solve](https://solve.mit.edu/solutions/49585) · [Cisco newsroom on Replate](https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2020/m09/how-technology-is-being-used-to-maximize-the-food-rescue-process.html)
- [Goodr: surplus food recovery](https://goodr.co/food-waste-solutions/surplus-food-recovery/) · [FoodNavigator on Goodr](https://www.foodnavigator-usa.com/Article/2018/10/29/Goodr-tackles-food-waste-and-creates-passive-revenue-stream-for-companies-donating-food-surplus)
- [Chatelaine: food waste apps](https://www.chatelaine.com/food/food-waste-apps/) · [World Economic Forum: food waste apps](https://www.weforum.org/stories/2022/06/reduce-food-waste-apps-smartphones/)
