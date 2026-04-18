# Audit Findings — Apartment Finder

Raw observations gathered by reading the codebase directly. Organized by
surface. Each finding notes the exact files and lines that demonstrate the
issue, and whether a downstream requirement captures the fix.

Legend:

- 🔴 critical — broken, data-loss, or obvious security issue
- 🟠 high — breaks the user experience or a core promise of the product
- 🟡 medium — quality / polish / competitive gap
- 🟢 low — nice-to-have, backlog

---

## 1. Theme system — dark mode is broken

🔴 **The dark-mode toggle you called out is broken because two systems are fighting.**

### Evidence

- `src/lib/context/ThemeContext.tsx` defines a `ThemeProvider` that:
  - reads/writes `localStorage["apartment-finder-theme"]`
  - toggles `document.documentElement.classList`
  - exposes `useTheme()` with `{theme, toggleTheme}`
- `src/components/layout/Navbar.tsx` (lines 26-34 and 71-76) maintains its **own** `darkMode` local state:
  - reads/writes `localStorage["theme"]` (different key!)
  - toggles `document.documentElement.classList` directly
- `src/app/dashboard/settings/page.tsx` (lines 56-58 and 157-163) does a **third** copy of the same logic, again using `localStorage["theme"]`.
- `src/app/layout.tsx` **does not mount** `ThemeProvider`. The context exists but nothing consumes it.
- There is **no pre-hydration bootstrap script** in `<head>` that applies the saved theme before React paints. That means:
  - Every page load briefly shows the light theme regardless of the saved preference (FOUC).
  - After hydration, whichever component loads first wins the toggle.

### Impact

- On first load with `localStorage["theme"] = "dark"` you see a white flash before the nav renders dark.
- Toggling the nav button writes to `localStorage["theme"]`.
- Toggling the settings toggle writes to `localStorage["theme"]` too.
- Anything that later reads `localStorage["apartment-finder-theme"]` (i.e. `ThemeContext`) sees `null` and the two systems diverge.
- The `prefers-color-scheme` media query in `ThemeContext.tsx` (line 24) is never applied because the context isn't mounted.

### Captured by

- Requirement 1 — Unified theme system

---

## 2. Search filters — country and city are independent

🟠 **Cities in the search page filter are a hard-coded list and do not depend on the selected country.**

### Evidence

- `src/app/search/page.tsx` line 37:

  ```ts
  const CITIES = ["Berlin", "Paris", "London", "Amsterdam", "Barcelona", "Rome", "Lisbon", "Vienna"];
  ```

  A flat 8-city array with no country relationship. Selecting "Spain" still shows "Berlin" and "Paris" as city options.
- `src/app/listings/new/page.tsx` has Nominatim-backed city autocomplete that DOES filter by country (via `country_code`), so the creation path gets this right. The search path does not.
- The search backend (`src/lib/services/search.ts` line 156) filters on `address.city` as a plain equality match, so the backend supports any city string — the limitation is purely frontend dropdown hardcoding.

### Impact

- Users selecting "Portugal" still see cities like Berlin and Vienna that will produce zero results.
- Impossible to search cities outside the hardcoded list (Hamburg, Madrid, Milan, etc.) even though listings in those cities exist.
- Inconsistent with the creation form which uses real geocoding.

### Captured by

- Requirement 2 — Country-dependent city filter

---

## 3. Listing data model — competitively thin

🟠 **The `Listing` model lacks fields that every competitor treats as core.**

### Evidence — current model (`src/lib/db/models/Listing.ts`):

Has: title, description, propertyType, purpose, address, location, monthlyRent, currency, availableDate, photos, photoHashes, tags, isSharedAccommodation, currentOccupants, availableRooms, isFurnished, isPetFriendly, hasParking, hasBalcony, floorArea, floor, totalFloors, status, isFeatured, scamRiskLevel, priceHistory, expiresAt.

**Missing vs. HousingAnywhere / Idealista / SpotAHome / Immobilienscout24:**

| Field | Why | Who has it |
|---|---|---|
| `bedrooms` (distinct from availableRooms) | Availability ≠ size | Every portal |
| `bathrooms` | Core filter | Every portal |
| `beds` | Differentiates 1-bed studios from shared-bed hostels | Airbnb, SpotAHome |
| `deposit` + `depositCurrency` | Legally required disclosure in many EU countries | Immobilienscout24, Idealista |
| `utilitiesIncluded` (bool or enum list) | Huge filter | Idealista, SpotAHome |
| `billsEstimate.monthlyTotal` | Transparent cost comparison | HousingAnywhere |
| `minStayMonths` / `maxStayMonths` | Mid-term market differentiator | HousingAnywhere, SpotAHome, Uniplaces |
| `leaseType` enum (fixed-term / open-ended / student / short-stay) | Core filter | Every portal |
| `heatingType` enum | Big winter-rental factor | Immobilienscout24 |
| `energyRating` enum (A-G) | Legally required in EU | Idealista, Immobilienscout24 |
| `yearBuilt` | Standard filter | Every portal |
| `amenities` structured list (washing machine, dishwasher, fiber internet, elevator, concierge, gym, terrace, air conditioning) | Core filter | Every portal |
| `houseRules` (no smoking, couples ok, students ok, professionals ok) | HMO / shared-living market | SpotAHome, Badi |
| `accessibility` (step-free entry, elevator, grab bars) | ADA / European accessibility directive | Every portal (increasingly) |
| `nearbyTransit` array with distanceMeters + line/station | Seeker's #1 question | Idealista, Rightmove |
| `floorPlan` URL | Standard in DE/NL | Immobilienscout24, Funda |
| `virtualTour` URL | Post-COVID standard | Every portal |
| `visibility` enum (public / verified_only / private_link) | Trust / anti-scam | HousingAnywhere |
| `verifiedAt` / `verifiedBy` | Trust signal | SpotAHome ("Certified") |
| `viewCount` | Social proof + analytics | Every portal |
| `inquiryCount` | Social proof + ranking signal | Every portal |
| `ranking.score` | Search ordering | Every portal |

### Impact

- The search filter UI exposes "Bedrooms" (line 286 of search/page.tsx) but queries `availableRooms` as the bedroom count — which is the "rooms available in a flatshare" field, NOT the total bedrooms. So a 3-bedroom apartment rented whole reports `availableRooms=3` only if `isSharedAccommodation` is true, otherwise 0 or null. The field is semantically wrong for non-shared rentals.
- No way for a seeker to answer "is heat included?" — the decisive question for Nordic / German rentals in winter.
- No way to filter by deposit or lease length — the two hard constraints most serious seekers have.

### Captured by

- Requirement 3 — Complete listing data model
- Requirement 4 — Bedrooms ≠ availableRooms semantics
- Requirement 5 — Structured amenities
- Requirement 6 — Energy rating (EU compliance)

---

## 4. Navbar — good foundation, multiple polish gaps

🟡 **Navbar has real bugs beyond the theme issue, and misses features expected of a modern rental platform.**

### Evidence

- **Session prop shape inconsistency** (lines 39-47): Navbar's `SessionUser` interface declares `id`, `email`, `fullName`, `role`, `mongoId`, `isSuspended`. But `src/lib/api/session.ts` returns `SessionUser` with `supabaseId` + `mongoId` + `email` + `fullName` + `role` — no top-level `id`. Every consumer has to know the mapping.
- **Bell icon is dead** (lines 119-123): button renders but has no `onClick`, no unread count badge, doesn't open the notification panel component that exists at `src/components/notifications/NotificationPanel.tsx`.
- **No "Create Listing" CTA for posters**: Posters have no direct nav entry to `/listings/new` — they have to go through dashboard → listings → new.
- **No search bar in the navbar**: Every competitor has a persistent search bar or quick-city selector in the nav (Idealista, Rightmove, Airbnb). Users have to click "Search" → land on the filter page.
- **No locale-aware currency display**: The CurrencySelector writes to localStorage but prices render with whatever currency the listing was posted in — no live FX conversion at display time even though `src/lib/services/currency.ts` exists.
- **Mobile menu lacks the "post a listing" CTA** (lines 188-212).
- **No "saved" or "viewed recently" quick access** — both are competitive table stakes.
- **Sign-out is buried in a dropdown with no confirmation** — accidental sign-outs are a known UX issue.
- **No unread message indicator** on the "Messages" nav entry.
- **Admin-panel link has no visual admin indicator** in the avatar chip; admin users look identical to regular users in the navbar.

### Captured by

- Requirements 7-14 — Navbar overhaul

---

## 5. User profile — public page is superficial

🟡 **The public user profile (`src/app/users/[id]/page.tsx`) doesn't represent the trust the product promises.**

### Evidence

- Avatar falls back to `https://placehold.co/120x120?text=<initial>` — no gravatar or uploaded photo logic even though `user.profilePhoto` exists in the model.
- Stats grid hardcodes `bg-white border` — broken in dark mode (see line 160-168 of users/[id]/page.tsx; no `dark:` variants).
- Same dark-mode break on reviews grid (lines 185-205) and listings grid (217-240).
- "Badge" logic reduces a user's entire history to three values (`new | trusted | verified`). Competitors offer badge taxonomies: "Verified ID", "Verified Phone", "Landlord since YYYY", "Response rate 98%", "Response time <2h", "Speaks EN/DE/ES", "Professional landlord". The profile shows none of these.
- No "contact me" CTA visible — the only way to message a poster from a profile page is to open one of their listings.
- `profileCompleteness` is shown as a % but seekers don't care about sellers' completeness; they care about verification state. Currently `idVerified` is displayed on the owner's own settings page but NOT surfaced on the public profile.
- No "last active" timestamp.
- No "member since 2024" detailed breakdown (quarter, year) — Airbnb shows this prominently to build trust on short tenure accounts.
- No language list for the poster.
- No response rate / response time metrics at all.
- No review breakdown by rating (1★ 2★ ... 5★ bars).
- Review rendering uses `★/☆` text with no accessible label.

### Captured by

- Requirements 15-19 — Profile overhaul

---

## 6. Listing detail — good bones, several specific gaps

🟡 **`src/app/listings/[id]/page.tsx` is serviceable but well behind competitors.**

### Evidence

- **Photo gallery is a single `img`** with a dot selector — no lightbox, no swipe, no keyboard navigation, no "view all photos" button. Every competitor has a full-screen gallery.
- **No floor plan / virtual tour** section even if those fields existed.
- **"Poster" sidebar card is hardcoded "P" initial** (lines 197-213): It doesn't fetch the actual poster (no API call, no poster name, no trust score display, no photo). Comment even says "coming soon" in the copy. This on the most important card on the page.
- **No "similar listings" / "other listings from this poster"** section.
- **No "save listing" heart button visible** on the detail page — you can only favorite from search results.
- **No share button** (copy link, WhatsApp, email).
- **No report listing button** even though `src/components/reports/ReportModal.tsx` exists.
- **No nearby transit / amenities** — we have `NeighborhoodGuide` but only a single link to it.
- **No price breakdown** (base rent + deposit + utilities + agency fee + total first month).
- **Viewing request form** (lines 246-280): one datetime input, no alternate-time suggestion, no calendar availability, no meeting-type (in-person / virtual) picker.
- **Map is a tiny `aspect-square`** (lines 230-240) — almost unusable for orientation.
- **No breadcrumbs** (`Home > Search > Berlin > Listing Title`).
- **No "last updated" timestamp**.
- **No report-scam button**.
- **The "Edit" button (line 130)** is always rendered — even for non-owners, non-admins. Not a security hole (backend checks auth) but a UX confusion.

### Captured by

- Requirements 20-28 — Listing detail overhaul

---

## 7. Search page — functional but dated UX

🟡 **Strong feature set (drawer, map, boundary draw, saved searches) but several missing pieces and one bad filter.**

### Evidence

- **No sort** (lines 417-422 only render "N listings found"). Competitors all offer: newest, price ascending, price descending, closest to transit, most relevant.
- **Bedroom filter queries `availableRooms`** (search.ts line 177) — semantically wrong for non-shared listings. See finding #3.
- **No "price per m²"** display — standard in DE/NL/ES markets.
- **No results-per-page selector** — hardcoded to 20.
- **No map/list toggle** — currently a "Show Map" button that always overlays, and you can't collapse results to just the map.
- **Map view lacks clustering** — confirmed by reading `src/components/search/MapView.tsx` — loads every pin individually, which won't scale past a few hundred listings.
- **No "listings you've viewed" persistence** — every search page load is fresh.
- **No saved search email alerts** — you can save a search but it's just a URL bookmark; no email-me-when-new-listings-match pipeline.
- **"Save Search" modal is inline** and blocks the whole page with a bare `<input>` — no accessibility labelling, no close-on-escape.
- **Filter drawer on mobile scrolls the whole page** instead of trapping focus.
- **The hardcoded `CITIES` list** doesn't update with Country (finding #2).
- **No "remove filter" chips** at the top of results so users can see what's active.
- **No "0 results? try loosening price/area" smart suggestions.**
- **Price inputs are uncontrolled strings** — no slider, no currency display.
- **"Furnished" checkbox forces `true`** — there's no way to say "only UN-furnished" or "either".

### Captured by

- Requirements 29-38 — Search overhaul

---

## 8. Homepage — underweight

🟡 **`src/app/page.tsx` is 25 lines of JSX and mostly 3D hero + feature cards + 6 listings.**

### Evidence

- **No city / neighborhood quick-entry** (every rental portal leads with this).
- **Hero CTA is generic** ("Start Searching") with no search bar.
- **3D hero (Hero3D) is dynamic-imported but heavy** — it's a Three.js scene on the landing page.
- **Featured listings fetched client-side** (`useEffect` + `fetch("/api/listings/featured")`) rather than SSR — hurts LCP and SEO.
- **No "popular cities" / "popular neighborhoods" grid.**
- **No trust signal strip** (# listings, # verified posters, # cities).
- **No "how it works" step-by-step** for new users.
- **No "latest from the blog" strip** even though blog exists.
- **No testimonials / case studies.**

### Captured by

- Requirements 39-43 — Homepage overhaul

---

## 9. Listing creation — buried feature set

🟡 **`src/app/listings/new/page.tsx` has the data fields for bedrooms? No. It has floor/totalFloors + floorArea + shared accommodation flags. Missing:**

### Evidence

Lines 92-112 show the form state shape. It lacks:

- `bedrooms` (separate from `availableRooms` which is the shared count)
- `bathrooms`
- `beds`
- `deposit` amount + currency
- `utilitiesIncluded`
- `billsEstimate`
- `minStayMonths` / `maxStayMonths`
- `leaseType`
- `heatingType`
- `energyRating`
- `yearBuilt`
- Structured amenity list (the free-form `tags` field is a hack around not having a vocabulary)
- `houseRules`
- `accessibility` flags
- `nearbyTransit` (could be auto-populated post-geocode)
- `floorPlan` / `virtualTour` URLs

Plus UX:

- The 4-step wizard has no "save as draft" at any point. If a poster navigates away mid-flow, everything is lost.
- No photo reorder / drag-and-drop.
- No photo caption / alt text entry.
- No rich-text description editor — just a plain textarea. Every competitor has at least minimal formatting.
- No live preview of how the listing will look.

### Captured by

- Requirements 44-51 — Listing creation overhaul

---

## 10. Favorites — feature exists but list view is thin

🟡 **`src/app/dashboard/favorites/page.tsx` works but has gaps.**

### Evidence

- No folders / collections (Pinterest-style "Paris trip", "Berlin move" buckets) — Airbnb / Idealista both have this.
- No sharing of a favorites list with a roommate / partner.
- No notes per favorite.
- No "price dropped since saved" indicator (the data exists — `priceHistory` — but it's not rendered here).
- No sort (just default order).
- No "notify me if this listing changes / becomes unavailable".

### Captured by

- Requirement 52 — Favorites overhaul

---

## 11. Messages — serviceable but thin

🟡 **`src/app/dashboard/messages/page.tsx` works for 1:1 threads but lacks expected features.**

### Evidence

- No file/photo/document attachment.
- No canned replies / templates ("Sorry, just rented", "Yes, viewings this weekend").
- No translation button — critical for expat target market where poster and seeker rarely share a language.
- No "mark as spam / scam" action from within a thread.
- No read receipts ("seen 2 hours ago").
- No typing indicator.
- No emoji / markdown support.
- No response time shown against the poster.
- No search within messages.
- No archive / mute.
- The empty-state emoji (line 175) renders a literal 💬 — per the existing audit spec, all emoji icons should be SVG.
- The thread list doesn't show the other participant's avatar — just their name.

### Captured by

- Requirement 53 — Messaging overhaul

---

## 12. Footer — adequate but basic

🟢 **`src/components/Footer.tsx` covers the basics.**

### Evidence

- No social media links (Instagram / LinkedIn / Twitter).
- No newsletter signup.
- No country selector (currently only language + currency).
- No "popular cities" links for SEO.
- No trust badges (SSL, ISO, EU data residency).
- No app store badges (if a mobile app is ever built).

### Captured by

- Requirement 54 — Footer overhaul

---

## 13. Accessibility — spotty

🟡 **Existing audit spec covers WCAG AA broadly; these are specifics worth flagging.**

### Evidence

- Avatar in `users/[id]/page.tsx` uses a placeholder text initial but no descriptive alt text for blind users who only get "J avatar".
- Review stars rendered as `★☆` text without `aria-label="4 out of 5 stars"`.
- The Navbar dropdown is toggled by a button with `aria-expanded` correctly set but no `role="menu"` / `role="menuitem"` on the children.
- The dropdown doesn't trap focus when open and doesn't close on Escape.
- The mobile filter drawer doesn't trap focus and doesn't close on Escape.
- The save-search modal doesn't trap focus and doesn't close on Escape.
- Form inputs on the homepage hero have no visible labels (relies on placeholders).
- Several dark-mode-broken cards use `bg-white border` without `dark:` variants — contrast fails in dark mode.

### Captured by

- Requirement 55 — Accessibility sweep (supplements webapp-full-audit Req 25)

---

## 14. SEO / social — partial

🟡 **Existing `competitive-feature-parity` Req 5 covers this; findings add specifics.**

### Evidence

- `src/app/sitemap.ts` exists but was not read as part of this audit; re-review recommended.
- Listing detail pages are **client-rendered** (`"use client"` at the top). SEO meta is likely broken — crawlers won't see the listing content.
- Same for homepage — `"use client"` with `useEffect` fetching featured listings means the initial HTML has no listings, no prices, no cities.
- No `<link rel="canonical">` strategy observed.
- No `hreflang` tags for the 6 locales.

### Captured by

- Requirement 56 — SSR for SEO-critical pages

---

## 15. Performance — quick observations

🟢 **No deep perf audit, but some observations.**

### Evidence

- 3D Three.js hero is on the landing page.
- `useEffect` fetches on every top-level page (no server-rendered data).
- No Suspense boundaries for fetches — content pops in after a blank state.
- MapView on search page loads all pins (no clustering).
- Featured listings call `/api/listings/featured` separately from the homepage SSR.

### Captured by

- Requirement 57 — Performance budget (supplements webapp-full-audit Req 14)

---

## 16. Admin — already well-served

🟢 **The admin surface has its own set of routes (`/admin/users`, `/admin/listings`, `/admin/reports`, `/admin/scam-review`, `/admin/analytics`, `/admin/audit-log`, `/admin/blog`, `/admin/neighborhoods`, `/admin/content`). Not deeply audited this pass; existing specs cover most of it.**

---

## 17. Architectural observations

- **No observability**: no Sentry, no Datadog, no structured logging (only `console.warn` / `console.error`).
- **No feature flags**: every feature is "always on" — dangerous for iterative rollout.
- **No A/B testing framework**: impossible to test UI hypotheses.
- **Redux store exists but is used sparingly** (`src/lib/store/`) — most state is component-local useState.
- **Email templates are inline** (`src/lib/services/email.ts` — not deeply read but the existing spec calls this out).
- **No background jobs / queue** — listing expiration runs via cron route only.

### Captured by

- Requirement 58 — Observability & feature flags (non-blocking, lower priority)

---

## Summary — where to focus

| Band | Requirements | Why |
|---|---|---|
| 🔴 P0 | 1 (theme), 4 (bedroom field), 20–22 (listing poster card) | Broken / misleading |
| 🟠 P1 | 2 (city dependency), 3, 5, 6 (listing model), 7–14 (navbar), 20–28 (listing detail) | Core UX & data |
| 🟡 P2 | 15–19 (profile), 29–38 (search), 44–51 (creation), 39–43 (homepage) | Competitive parity |
| 🟢 P3 | 52 (favorites), 53 (messages), 54 (footer), 55–58 (a11y, SEO, perf, obs) | Polish & long tail |

The spec in `requirements.md` / `design.md` / `tasks.md` uses these findings verbatim.
