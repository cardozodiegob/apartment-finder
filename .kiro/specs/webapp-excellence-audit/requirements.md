# Requirements Document

## Introduction

This specification captures the full audit of the Apartment Finder webapp plus the competitive scan of seven European mid/long-term rental and student-housing platforms. The audit surfaces one broken feature (dark-mode toggle), two misleading data behaviours (bedroom field semantics, hard-coded city dropdown), and sixty-plus competitive or polish gaps.

The intent is to make Apartment Finder the strongest European rental product for expat seekers and landlords, prioritising: trust (branded tenant protection, verification badges, response metrics), data completeness (bedrooms, bathrooms, deposit, utilities, energy rating, lease type, stay length, structured amenities), and UX (unified theme, country-dependent filters, modern search, complete profile and listing detail pages).

This spec supplements — does not replace — two existing specs. `webapp-full-audit` handled security, session, and infrastructure hardening. `competitive-feature-parity` captured eight baseline feature gaps (messages, viewings, documents, compare, SEO, i18n, neighborhood guides, blog). Everything here is net-new scope grounded in direct code reading (`AUDIT_FINDINGS.md`) and public competitor research (`COMPETITIVE_SCAN.md`).

No production-affecting code changes are made in this pass. The entire deliverable is the spec.

## Glossary

- **App** — the Apartment Finder Next.js webapp
- **Seeker** — a user with role `seeker` searching for rentals
- **Poster** — a user with role `poster` / `landlord_poster` listing properties
- **Listing** — a `Listing` document in MongoDB
- **Theme_System** — the unified dark/light theme subsystem (to be built), replacing the three current competing implementations
- **Theme_Bootstrap** — the pre-hydration `<script>` in `<head>` that applies the saved theme before React renders, eliminating the flash of unstyled content (FOUC)
- **Country_City_Index** — the lookup table (or Nominatim-backed query) that maps a country to its valid city set in the search filter
- **Amenity_Vocabulary** — the fixed enum of structured amenities (elevator, dishwasher, washing_machine, air_conditioning, fibre_internet, gym, concierge, terrace, wheelchair_accessible, etc.) that replaces the free-form `tags` field for filter-critical features
- **Verified_Badge** — the public badge on a listing or poster indicating the platform has verified identity, property existence, or both
- **Move_In_Guarantee** — the 48-hour tenant-protection window adapted from HousingAnywhere; the seeker can flag mismatches and receive a refund within 48 hours of moving in
- **Response_Metrics** — the aggregated `responseRate` and `responseTimeHours` computed per poster from messaging activity
- **Search_Engine** — the existing `src/lib/services/search.ts` service plus new filter fields
- **Trust_Engine** — the existing `src/lib/services/trust.ts` service plus new public signals
- **Listing_Service** — the existing `src/lib/services/listings.ts` service
- **Competitor_Set** — `HousingAnywhere`, `Spotahome`, `Uniplaces`, `Nestpick`, `Idealista`, `ImmoScout24`, `Rightmove` (see `COMPETITIVE_SCAN.md`)

---

## Requirements

### Requirement 1: Unified Theme_System and Theme_Bootstrap

**User Story:** As a user, I want the dark/light theme toggle to work consistently across the entire app and persist across page loads without a flash of the wrong theme, so that my preference is honored and the interface feels polished.

#### Acceptance Criteria

1. THE App SHALL expose exactly one `ThemeProvider` context at the `src/app/layout.tsx` root; the three existing competing theme implementations (Navbar local state, settings local state, unused `ThemeContext`) SHALL be removed in favour of the unified provider
2. THE Theme_System SHALL store the user's theme preference in `localStorage` under exactly one key; the `"theme"` key SHALL be the canonical key and the `"apartment-finder-theme"` key SHALL be removed
3. THE Theme_System SHALL support three persisted states: `"light"`, `"dark"`, and `"system"`; the `"system"` state SHALL honour `prefers-color-scheme` and react to OS-level theme changes
4. WHEN the root layout renders, THE Theme_Bootstrap SHALL inject an inline `<script>` tag into `<head>` that reads the stored preference and applies the `dark` class to `document.documentElement` BEFORE React hydration
5. THE Theme_Bootstrap SHALL execute synchronously and SHALL NOT depend on any external script
6. WHEN a user toggles theme from any surface (Navbar button, settings page, keyboard shortcut), THE Theme_System SHALL write to the single canonical key and update every consumer via the context
7. THE Theme_System SHALL expose a `useTheme()` hook returning `{ theme: "light" | "dark" | "system", resolvedTheme: "light" | "dark", setTheme(t) }`
8. IF the stored preference value is invalid or missing, THEN THE Theme_System SHALL default to `"system"`
9. THE Navbar SHALL consume `useTheme()` instead of managing its own `darkMode` state
10. THE Settings page SHALL consume `useTheme()` instead of managing its own `darkMode` state

---

### Requirement 2: Country-dependent city filter on the search page

**User Story:** As a seeker filtering by country, I want the city dropdown to only show cities in the selected country, so that I never see options that will produce zero results.

#### Acceptance Criteria

1. WHEN a user selects a country in the search filter, THE App SHALL update the city dropdown to show only cities within that country
2. WHEN no country is selected, THE App SHALL show a disabled city dropdown with placeholder text "Select a country first" OR show an autocomplete input without a preset list
3. THE App SHALL populate the country→cities mapping from the same Nominatim-backed source used by `src/app/listings/new/page.tsx`; the hard-coded 8-city `CITIES` array in `src/app/search/page.tsx` SHALL be removed
4. WHEN a user changes country AFTER selecting a city, THE App SHALL clear the city selection and update the submitted search URL to remove the stale `city` parameter
5. WHERE the user types in the city field, THE App SHALL present type-ahead suggestions debounced at 300 ms, scoped to the selected country via Nominatim's `countrycodes` parameter (mirroring `COUNTRY_CODES` in `listings/new`)
6. WHEN the selected country has no known cities in the cached lookup, THE App SHALL fall back to free-text city entry and accept the user's input verbatim
7. THE App SHALL cache country→city queries in `sessionStorage` for 24 hours to reduce Nominatim load

---

### Requirement 3: Expanded Listing data model

**User Story:** As a seeker, I want to see bedrooms, bathrooms, deposit, utility inclusion, lease length, and energy rating on every listing, so that I have the same information every competitor provides.

#### Acceptance Criteria

1. THE Listing model SHALL add `bedrooms: number` (required for non-shared listings, nullable for shared)
2. THE Listing model SHALL add `bathrooms: number` (required)
3. THE Listing model SHALL add `beds: number` (optional; used when rooms contain multiple beds)
4. THE Listing model SHALL add `deposit: { amount: number; currency: string; }` (optional)
5. THE Listing model SHALL add `utilitiesIncluded: enum[electricity, water, gas, heating, internet, all, none]` as a multi-value set
6. THE Listing model SHALL add `billsEstimate: { monthlyTotal: number; currency: string; breakdown?: Record<string, number> }` (optional)
7. THE Listing model SHALL add `minStayMonths: number` and `maxStayMonths: number` (optional, validated `1 <= min <= max`)
8. THE Listing model SHALL add `leaseType: enum["fixed_term","open_ended","student","short_stay"]` (required)
9. THE Listing model SHALL add `heatingType: enum["central","individual_gas","individual_electric","heat_pump","district","none","unknown"]` (optional)
10. THE Listing model SHALL add `energyRating: enum["A","B","C","D","E","F","G","exempt","pending"]` (optional, recommended in all EU jurisdictions)
11. THE Listing model SHALL add `yearBuilt: number` (optional)
12. THE Listing model SHALL add `floorPlanUrl: string` and `virtualTourUrl: string` (optional)
13. THE Listing model SHALL add `viewCount: number` (default 0) and `inquiryCount: number` (default 0)
14. THE Listing model SHALL add `verifiedAt: Date` and `verifiedBy: ObjectId` (optional; references a User with role `admin`)
15. THE Listing model SHALL add compound indexes `{ leaseType: 1, status: 1 }`, `{ energyRating: 1, status: 1 }`, `{ bedrooms: 1, bathrooms: 1, status: 1 }`
16. THE Listing creation form SHALL collect every new field (with reasonable defaults), grouped into the existing 4-step wizard
17. THE Zod schema `createListingSchema` SHALL enforce the same constraints as the model
18. THE existing `currentOccupants` and `availableRooms` fields SHALL retain their current semantics and SHALL only be used for `isSharedAccommodation = true` listings
19. THE Listing detail page SHALL render every new field when set, with a labelled row in the sidebar or a dedicated "Facts" section
20. WHERE a listing has no `energyRating`, THE Listing detail page SHALL display "Energy rating not provided" rather than hiding the field silently

---

### Requirement 4: Fix bedroom-filter semantics

**User Story:** As a seeker filtering "3 bedrooms", I want results that actually have 3 bedrooms, not 3 available rooms in a flatshare, so that the filter matches my mental model.

#### Acceptance Criteria

1. THE Search_Engine SHALL filter by `bedrooms` (the new field from Requirement 3) instead of `availableRooms` when the user passes `bedrooms` in the query
2. THE Search_Engine SHALL continue to filter by `availableRooms` only when the user passes an explicit `availableRooms` parameter AND the search scope includes shared-accommodation listings
3. THE Search page filter UI SHALL label the control "Bedrooms" and map it to the `bedrooms` query param
4. THE Search page filter UI SHALL add a separate "Rooms available" control visible only when "Shared accommodation" is checked, mapped to `availableRooms`
5. THE existing `filtersSlice` Redux slice SHALL rename `bedrooms` to `bedroomsExact` (or add a migration comment) and add `minBedrooms`, `maxBedrooms` for range filtering
6. THE Search page SHALL add a "Bathrooms" minimum filter (e.g. "1+", "2+", "3+")
7. WHEN a user submits a search with `bedrooms=3`, THE Search_Engine SHALL match listings where `bedrooms >= 3` (not strict equality, so the user sees 3-bed and 4-bed results)

---

### Requirement 5: Structured Amenity_Vocabulary

**User Story:** As a seeker, I want to filter by amenities like dishwasher or elevator using checkboxes, so that I do not need to guess the right free-text tag.

#### Acceptance Criteria

1. THE App SHALL define an `Amenity_Vocabulary` constant enum containing at minimum: `elevator`, `dishwasher`, `washing_machine`, `dryer`, `oven`, `microwave`, `air_conditioning`, `fibre_internet`, `cable_tv`, `gym`, `pool`, `concierge`, `terrace`, `garden`, `fireplace`, `wheelchair_accessible`, `step_free_entry`, `bike_storage`, `storage_unit`, `workspace`, `kids_friendly`
2. THE Listing model SHALL add `amenities: Amenity[]` as a structured array (default `[]`)
3. THE Listing creation form SHALL render a grouped checkbox grid for the full vocabulary with i18n labels
4. THE Search page SHALL render a collapsed amenity-filter group that, when expanded, offers one checkbox per amenity
5. THE Search_Engine SHALL support `amenities=dishwasher,elevator` query syntax, matching listings where `amenities` contains all of the requested values
6. THE existing `tags: string[]` field SHALL be preserved for free-form descriptors (neighbourhood nickname, listing "quirks") but SHALL NOT be used by the primary amenity filter
7. THE Listing detail page SHALL render amenities as a labelled icon grid (8+ icons visible, "show all" expansion)
8. THE Amenity_Vocabulary SHALL be typed at compile time so adding an amenity is a single-line change in one place

---

### Requirement 6: Energy rating (A–G) disclosure

**User Story:** As a seeker in the EU, I want to see a listing's energy rating on the listing card and detail page, so that I can assess utility costs and regulatory compliance.

#### Acceptance Criteria

1. THE Listing card (search results, favorites, comparison) SHALL render the `energyRating` as a coloured A–G badge (green=A → red=G) when the value is present
2. THE Listing detail page SHALL render the energy rating with a short explanatory caption ("Energy efficiency: C — typical for post-2000 apartments")
3. THE Search page SHALL add an energy-rating minimum filter ("A or better", "C or better", "E or better", "any")
4. THE Listing creation form SHALL present energy rating as a dropdown with descriptive labels, defaulting to `"pending"` with a tooltip: "Required for most EU rentals — we'll remind you when one is available"
5. WHERE the listing country is in `{GB, IE}`, THE App SHALL label the field "EPC rating"; WHERE the country is in `{DE, AT, CH}`, THE App SHALL label it "Energieausweis"; otherwise "Energy rating"
6. THE rating badge SHALL be rendered with WCAG 2.1 AA compliant contrast for all seven band colours

---

### Requirement 7: Navbar — notification bell wiring

**User Story:** As a logged-in user, I want the bell icon in the navbar to open my notification panel and show my unread count, so that I can see platform activity at a glance.

#### Acceptance Criteria

1. WHEN a logged-in user clicks the bell icon, THE Navbar SHALL open the existing `NotificationPanel` component as a dropdown anchored to the bell
2. WHEN unread notifications exist, THE Navbar SHALL render a small red badge on the bell showing the count (capped at `99+`)
3. WHEN the user opens the panel, THE Navbar SHALL mark displayed notifications as read via the existing notifications API
4. WHEN the user clicks outside the panel or presses Escape, THE Navbar SHALL close the panel
5. THE Navbar SHALL poll `/api/notifications?countOnly=true` every 60 seconds while the tab is visible to refresh the unread badge

---

### Requirement 8: Navbar — admin visual indicator

**User Story:** As an admin, I want my admin role to be visually obvious in the navbar, so that I know when I'm logged in as admin vs as a regular user.

#### Acceptance Criteria

1. WHEN a user with role `admin` is logged in, THE Navbar SHALL render a small "Admin" chip inline with the user's avatar
2. THE admin chip SHALL use the colour token `--color-navy-600` with white text for visibility in both themes
3. THE admin-panel link in the user dropdown SHALL remain the only administrative shortcut; the chip is purely visual

---

### Requirement 9: Navbar — posters quick-create CTA

**User Story:** As a poster, I want a prominent "Post a Listing" button in the navbar, so that I don't have to drill into the dashboard to create a new listing.

#### Acceptance Criteria

1. WHEN a user with role `poster` is logged in, THE Navbar SHALL render a "Post a Listing" primary button directly in the desktop nav (between "My Listings" and the language selector)
2. WHEN the user is a seeker, THE Navbar SHALL render a smaller "List your place" secondary link in the same position
3. THE mobile menu SHALL mirror the same CTA

---

### Requirement 10: Navbar — unified session shape

**User Story:** As a developer, I want the session object to have a single canonical shape consumed by every client component, so that the Navbar does not redeclare its own interface.

#### Acceptance Criteria

1. THE App SHALL export a single `SessionUser` type from `src/lib/api/session.ts` (already exists)
2. THE `/api/auth/session` endpoint SHALL return a response envelope of exactly `{ user: SessionUser | null }` with no `session.user` nesting
3. THE Navbar SHALL import `SessionUser` from `@/lib/api/session` and SHALL NOT redeclare the type
4. All client components that consume the session endpoint SHALL use the same import

---

### Requirement 11: Navbar — in-nav search trigger

**User Story:** As a visitor, I want to start a search directly from the navbar on every page, so that I don't have to leave my current page to type a query.

#### Acceptance Criteria

1. THE Navbar SHALL render a compact search trigger (magnifying-glass icon + placeholder "Search Berlin, Paris, or Madrid...") on desktop viewports ≥ 1024 px
2. WHEN a user clicks or focuses the search trigger, THE Navbar SHALL open a full-width command-palette-style search overlay anchored below the nav bar
3. THE overlay SHALL present: a city/country autocomplete input, property-type shortcut chips (Apartment/Room/House), and a primary "Search" button
4. WHEN the user submits, THE App SHALL navigate to `/search?country=...&city=...&propertyType=...` with any other filters preserved
5. ON mobile viewports, THE Navbar SHALL render the magnifying-glass icon only; clicking it navigates to the search page without the overlay
6. THE overlay SHALL close on Escape, on backdrop click, and on navigation

---

### Requirement 12: Navbar — unread message indicator

**User Story:** As a user with unread messages, I want a badge on the "Messages" link, so that I know to check my inbox.

#### Acceptance Criteria

1. WHEN the logged-in user has one or more unread message threads, THE Navbar SHALL render a small dot on the user avatar and on the "Messages" link in the dropdown/mobile menu
2. THE unread computation SHALL use the existing `thread.readBy` timestamp compared to `thread.lastMessageAt`
3. THE Navbar SHALL refresh the message-unread indicator on the same 60-second poll used for notifications

---

### Requirement 13: Navbar — sign-out confirmation

**User Story:** As a user, I don't want to accidentally sign out by misclicking the menu item, so that I don't lose my place in a multi-step flow.

#### Acceptance Criteria

1. WHEN a user clicks "Sign Out" in the dropdown, THE Navbar SHALL present a confirmation dialog ("Sign out of Apartment Finder?") with "Sign Out" and "Cancel" buttons
2. THE dialog SHALL trap focus and dismiss on Escape
3. WHEN the user confirms, THE Navbar SHALL call the existing logout flow
4. WHEN the user cancels, THE Navbar SHALL simply close the dialog with no side effects

---

### Requirement 14: Navbar — accessibility

**User Story:** As a keyboard or screen-reader user, I want the navbar dropdown and menus to be fully accessible, so that I can use the app without a mouse.

#### Acceptance Criteria

1. THE dropdown SHALL use `role="menu"` on the container and `role="menuitem"` on each link
2. WHEN open, THE dropdown SHALL support ↑ / ↓ arrow-key navigation between items
3. WHEN the user presses Escape inside the dropdown, THE Navbar SHALL close the dropdown and return focus to the trigger button
4. THE dropdown SHALL trap Tab focus within its items while open
5. THE mobile menu SHALL use `aria-expanded` on the hamburger and `role="dialog"` on the overlay

---

### Requirement 15: Profile page — dark-mode-correct rendering

**User Story:** As a dark-mode user, I want the public profile page to render correctly, so that stats, reviews, and listings are readable.

#### Acceptance Criteria

1. THE profile page SHALL replace every `bg-white border` class with the CSS-var-based `glass-card` or `bg-[var(--surface)] border border-[var(--border)]` pattern used on other pages
2. THE stats grid, review cards, and active-listings grid SHALL render with correct contrast in both light and dark themes
3. THE avatar fallback SHALL render a local SVG placeholder instead of the current `placehold.co` URL

---

### Requirement 16: Profile page — response metrics

**User Story:** As a seeker evaluating a poster, I want to see their response rate and typical response time, so that I know how likely they are to reply.

#### Acceptance Criteria

1. THE Trust_Engine SHALL compute `responseRate` as `repliedThreads / inboundThreads` over the trailing 90 days
2. THE Trust_Engine SHALL compute `responseTimeHours` as the median (50th-percentile) time from inbound message to the first outbound reply over the trailing 90 days
3. THE profile page SHALL display both metrics on the poster's profile card, with human-friendly labels: "Replies to 92% of messages" and "Typically replies within 3 hours"
4. WHERE a poster has fewer than 5 inbound threads in the trailing 90 days, THE App SHALL display "Not enough data" instead of a number
5. THE `/api/users/[id]/profile` endpoint SHALL return the metrics in the response payload
6. THE Trust_Engine SHALL cache computed metrics per user for 1 hour to avoid per-request aggregation

---

### Requirement 17: Profile page — verification badges

**User Story:** As a seeker, I want to see which verification checks a poster has passed, so that I can assess trust at a glance.

#### Acceptance Criteria

1. THE profile page SHALL display a badge set including: "ID verified", "Email verified", "Phone verified", "Landlord since <year>", "<N> transactions completed"
2. THE existing `idVerified` field SHALL drive the "ID verified" badge
3. THE existing `emailVerified` and (new) `phoneVerified` fields SHALL drive the corresponding badges
4. THE "Landlord since" badge SHALL render only when the user has at least one published listing
5. THE badges SHALL be visually distinct from scammy fake badges: use a muted outline style, not bright full-colour
6. Clicking a badge SHALL open a small popover explaining what the check means

---

### Requirement 18: Profile page — languages spoken

**User Story:** As a seeker, I want to know what languages a poster speaks, so that I can contact them in a shared language.

#### Acceptance Criteria

1. THE User model SHALL add `languagesSpoken: string[]` (ISO 639-1 codes, defaulting to `[preferredLanguage]`)
2. THE settings page SHALL present a multi-select for languages
3. THE profile page SHALL render language flags + labels below the name (e.g. "Speaks English, German, Spanish")
4. THE poster profile card on listing detail pages SHALL show the same languages

---

### Requirement 19: Profile page — review histogram

**User Story:** As a seeker, I want to see the distribution of a poster's review ratings, so that I can tell 4.5 from twenty 5-star reviews vs from a mix of 5s and 3s.

#### Acceptance Criteria

1. THE profile page SHALL render a 5-bar histogram below the trust-score showing the count of 1★, 2★, 3★, 4★, 5★ reviews
2. Each bar SHALL display the count and a percentage-width visualization
3. THE review stars in each review card SHALL carry an `aria-label` of the form "Rated 4 out of 5 stars"
4. THE `/api/users/[id]/profile` endpoint SHALL return the histogram in the payload (`reviewHistogram: Record<1|2|3|4|5, number>`)

---

### Requirement 20: Listing detail — real poster card

**User Story:** As a seeker viewing a listing, I want to see the actual poster's name, photo, trust indicators, and languages, so that I can evaluate them without leaving the page.

#### Acceptance Criteria

1. THE listing detail page SHALL populate the poster sidebar card from `listing.posterId` (populated via the existing `/api/listings/[id]` endpoint) — the current placeholder "P" SHALL be removed
2. THE card SHALL display: full name, profile photo (or initial fallback), trust score, verification badges (from Requirement 17), languages spoken, response rate + time (from Requirement 16), member-since year
3. THE card SHALL link to `/users/<posterId>` as a primary CTA
4. THE card SHALL provide a secondary "Message <firstName>" CTA that opens a pre-filled message thread
5. WHERE the poster is suspended, THE card SHALL display a warning banner and disable the message CTA

---

### Requirement 21: Listing detail — photo gallery

**User Story:** As a seeker, I want a full-screen photo gallery with keyboard navigation and thumbnails, so that I can properly evaluate the property visually.

#### Acceptance Criteria

1. THE listing detail page SHALL replace the current single-img + dots pattern with a gallery component providing: thumbnail strip, full-screen lightbox on click, ← / → keyboard navigation, Escape to close
2. THE gallery SHALL support swipe gestures on touch devices
3. THE gallery SHALL display "N of M" counter in the lightbox
4. THE gallery SHALL lazy-load photos below the fold
5. THE gallery SHALL render `floorPlanUrl` as an additional tab / button "View floor plan" when set
6. THE gallery SHALL render `virtualTourUrl` as a "Virtual tour" button that opens the URL in a new tab
7. WHERE a listing has no photos, THE gallery SHALL show a single SVG placeholder with the listing property type inline

---

### Requirement 22: Listing detail — breadcrumbs

**User Story:** As a seeker, I want breadcrumbs showing where I am (Home > Search > Berlin > Listing Title), so that I can navigate back up the hierarchy.

#### Acceptance Criteria

1. THE listing detail page SHALL render a breadcrumb bar at the top of the page: `Home › Search › <country> › <city> › <neighborhood?> › <title>`
2. Each segment SHALL be clickable and preserve the current search context where applicable (`/search?country=...&city=...`)
3. THE breadcrumb SHALL truncate long titles with an ellipsis

---

### Requirement 23: Listing detail — price breakdown

**User Story:** As a seeker, I want to see the full first-month cost (rent + deposit + utilities estimate + any agency fee), so that I can budget accurately.

#### Acceptance Criteria

1. THE listing detail sidebar SHALL render a "Total move-in cost" block when `deposit` OR `billsEstimate` is set
2. THE block SHALL show: Monthly rent, Deposit (with "refundable" caption), Estimated bills (if set), Subtotal, plus a footnote clarifying that first-month total may differ
3. THE block SHALL render amounts in the listing's currency with a secondary conversion to the seeker's selected currency via the existing `/api/currency/rates` endpoint
4. THE block SHALL omit the breakdown when only `monthlyRent` is set and display the existing simple price

---

### Requirement 24: Listing detail — save / share / report actions

**User Story:** As a seeker, I want to save, share, or report a listing directly from the detail page, so that I don't have to go back to search results.

#### Acceptance Criteria

1. THE listing detail page SHALL render a heart icon near the title; clicking it toggles the listing in the user's favorites (via the existing favorites API)
2. THE page SHALL render a share icon that opens a menu: "Copy link", "WhatsApp", "Email", "X / Twitter"
3. THE page SHALL render a flag icon that opens the existing `ReportModal` component
4. THE three action icons SHALL have `aria-label` attributes
5. WHEN an anonymous user clicks the heart, THE App SHALL redirect them to `/login?next=/listings/<id>`

---

### Requirement 25: Listing detail — edit button visibility

**User Story:** As a logged-in user, I only want to see the Edit button when I actually own the listing, so that I don't see a broken button.

#### Acceptance Criteria

1. THE listing detail page SHALL render the Edit button only when the session user's `mongoId` equals `listing.posterId` OR the user's role is `admin`
2. WHERE the current user cannot edit, THE button SHALL be hidden entirely (not just disabled)

---

### Requirement 26: Listing detail — similar listings

**User Story:** As a seeker who's just read a listing, I want to see similar options so that I can keep browsing if this one isn't right.

#### Acceptance Criteria

1. THE listing detail page SHALL render a "Similar listings in <city>" section below the main content
2. THE section SHALL fetch 6 listings via a new `/api/listings/similar?listingId=<id>` endpoint that filters by city, property type, a ±30% price band, and excludes the current listing
3. Each similar-listing card SHALL render the standard search-result card markup
4. WHEN the API returns zero matches, THE section SHALL render a subtle "Nothing similar right now — try the search page" link instead

---

### Requirement 27: Listing detail — nearby transit + amenities

**User Story:** As a seeker, I want to see what's within walking distance of the listing, so that I can judge the location.

#### Acceptance Criteria

1. THE Listing model SHALL add `nearbyTransit: { type: "tram"|"bus"|"metro"|"train"|"ferry"; line?: string; name: string; distanceMeters: number }[]` (optional)
2. THE Listing model SHALL add `nearbyAmenities: { category: "supermarket"|"pharmacy"|"school"|"park"|"gym"|"cafe"; name: string; distanceMeters: number }[]` (optional)
3. WHEN a poster creates/edits a listing with precise lat/lng, THE App SHALL call an Overpass (OpenStreetMap) query OR a Mapbox isochrone API to populate both arrays, with user confirmation before saving
4. THE listing detail page SHALL render each array as a labelled row: "🚇 Alexanderplatz (U2, U5, U8) · 6 min walk"
5. WHEN the listing has no nearby data, THE page SHALL show a link "Explore the neighborhood guide" for the corresponding neighborhood

---

### Requirement 28: Listing detail — larger map, view-expanded state

**User Story:** As a seeker, I want a properly-sized map showing the listing location, so that I can see the neighborhood context.

#### Acceptance Criteria

1. THE listing detail page SHALL enlarge the sidebar map from `aspect-square` (roughly 300×300) to a fixed 400×400 minimum, or render it as a full-width 16:9 block
2. THE map SHALL render a 500-meter radius circle around the pin (privacy default — exact address revealed only to the seeker who has made a booking)
3. THE map SHALL include a "View larger" button that opens a full-screen map modal
4. THE full-screen map SHALL show the pin plus the contents of `nearbyTransit` and `nearbyAmenities`

---

### Requirement 29: Search — sort controls

**User Story:** As a seeker, I want to sort results by price, newest, or closest to transit, so that I can scan them in the order that matches my priorities.

#### Acceptance Criteria

1. THE search page SHALL render a sort dropdown above the results grid with options: "Relevance" (default when `query` is set), "Newest", "Price: low → high", "Price: high → low", "Available soonest"
2. THE Search_Engine SHALL implement the sort in MongoDB via appropriate `.sort()` calls
3. THE sort choice SHALL persist in the URL query string as `sort=newest|priceAsc|priceDesc|available|relevance`
4. WHERE a seeker is viewing boundary results, THE sort SHALL apply inside the boundary

---

### Requirement 30: Search — price per m² badge

**User Story:** As a seeker comparing listings by value, I want to see the price per m² on each card, so that I can compare small expensive units to large cheap ones.

#### Acceptance Criteria

1. WHERE a listing has `floorArea > 0`, THE search result card SHALL render `€X/m²` inline with the monthly rent
2. THE computation SHALL use the listing's base currency, not the seeker's display currency
3. THE Listing detail page SHALL show the same metric in the sidebar price block

---

### Requirement 31: Search — results-per-page selector

**User Story:** As a seeker, I want to control how many results load at once, so that I can scan more listings without paginating as often.

#### Acceptance Criteria

1. THE search page SHALL render a "Show: 20 | 50 | 100 per page" segmented control
2. THE selection SHALL persist in the URL query string as `limit=<n>` (matching the existing `searchParamsSchema.limit` bounds)

---

### Requirement 32: Search — active-filter chips

**User Story:** As a seeker, I want to see what filters are currently applied as removable chips, so that I can undo a single filter without clearing everything.

#### Acceptance Criteria

1. THE search page SHALL render a chip row above the results grid showing one chip per active filter (e.g. "Berlin ×", "€500-1500 ×", "Furnished ×")
2. Clicking a chip's × icon SHALL remove that single filter and re-run the search
3. THE chips SHALL wrap on narrow screens
4. WHEN no filters are active, THE chip row SHALL be hidden

---

### Requirement 33: Search — map clustering

**User Story:** As a seeker viewing a map of 500 listings, I want nearby pins to cluster so I can see the data at continent zoom, so that the map doesn't become a wall of overlapping markers.

#### Acceptance Criteria

1. THE MapView component SHALL use Leaflet.markercluster (or an equivalent Leaflet plugin) to group pins by proximity
2. Clicking a cluster SHALL zoom in and expand the group
3. THE cluster marker SHALL show the count of underlying listings
4. THE clustering threshold SHALL be configured so that no cluster overlaps visually at the current zoom level

---

### Requirement 34: Search — recently viewed

**User Story:** As a seeker who's browsed several listings, I want to see a "Recently viewed" strip, so that I can quickly return to ones that caught my eye.

#### Acceptance Criteria

1. WHEN a user opens a listing detail page, THE App SHALL store `{ listingId, viewedAt }` in `localStorage` under key `recentlyViewedListings` (capped at 20 entries, FIFO)
2. THE search page SHALL render a "Recently viewed" strip above the results grid showing up to 6 recent listings
3. THE strip SHALL hydrate each entry by calling `/api/listings/<id>` in parallel at mount
4. WHEN an entry's listing no longer exists (404), THE strip SHALL remove it from localStorage silently
5. THE strip SHALL have a "Clear" button that empties the list

---

### Requirement 35: Search — saved-search email alerts

**User Story:** As a seeker with a saved search, I want to receive an email when new listings match, so that I don't have to check the site daily.

#### Acceptance Criteria

1. THE SavedSearch model SHALL add `emailAlertsEnabled: boolean` (default false) and `lastAlertedAt: Date` (optional)
2. THE save-search modal SHALL include an "Email me new matches" checkbox
3. WHERE the checkbox is enabled, THE App SHALL run a daily cron (new route `/api/saved-searches/cron`) that:
   - Iterates saved searches where `emailAlertsEnabled = true`
   - Runs the saved search's filters scoped to listings with `createdAt > lastAlertedAt`
   - Groups matches by user and emails once per user with up to 10 preview cards and a "See all" link
   - Updates `lastAlertedAt`
4. THE email SHALL honour the user's notification preferences — `listing` category SHALL gate the email
5. THE email SHALL render in the user's preferred language
6. THE email SHALL include an "unsubscribe from this search" link that sets `emailAlertsEnabled = false` for that saved search

---

### Requirement 36: Search — results empty-state suggestions

**User Story:** As a seeker who just got zero results, I want suggestions to broaden my filters, so that I don't give up.

#### Acceptance Criteria

1. WHEN `totalCount === 0`, THE search page SHALL render an empty state titled "No listings match all your filters"
2. THE empty state SHALL offer one-click "loosen" suggestions: "Widen price range to <min-20%> – <max+20%>", "Include shared accommodation", "Drop the neighborhood filter", "Search without the keyword"
3. Each suggestion SHALL be computed relative to the current query so that clicking it actually changes the filters and re-runs the search

---

### Requirement 37: Search — furnished tri-state

**User Story:** As a seeker who specifically wants an unfurnished flat, I want a filter that expresses "no furnished please", not just "must be furnished", so that I don't see results I'm filtering for the opposite of.

#### Acceptance Criteria

1. THE search page SHALL replace the single "Furnished" checkbox with a tri-state segmented control: "Either" (default) | "Furnished" | "Unfurnished"
2. THE Search_Engine SHALL map "Furnished" → `isFurnished: true`, "Unfurnished" → `isFurnished: false`, "Either" → omit the filter
3. THE serialization/deserialization in `filtersSlice` and URL params SHALL handle the three states

---

### Requirement 38: Search — map/list toggle + desktop layout

**User Story:** As a seeker using a small laptop, I want to choose between map-only, list-only, or split view, so that I can use my screen real estate.

#### Acceptance Criteria

1. THE search page SHALL replace the current "Show Map / Hide Map" button with a 3-way segmented control: "List" | "Map" | "Split"
2. "List" SHALL hide the map and show the full-width results grid
3. "Map" SHALL show a full-width map with a floating card overlay listing the top 10 results
4. "Split" (default on viewports ≥ 1280 px) SHALL show a 50/50 split with the map on the right
5. THE user's choice SHALL persist in `sessionStorage` under `searchLayout`

---

### Requirement 39: Homepage — SSR for SEO-critical content

**User Story:** As a platform operator, I want the homepage and listing detail pages to be crawlable by search engines, so that we rank for "apartment in berlin" and similar high-intent queries.

#### Acceptance Criteria

1. THE homepage SHALL render the featured listings, hero copy, and trust stats via server components (no `"use client"` at the page level)
2. THE listing detail page SHALL be converted from `"use client"` to a server component wrapping interactive client islands (photo gallery, viewing form, share menu)
3. THE server-rendered HTML SHALL include every listing's title, city, price, and first photo (as `<img>` with alt + width + height)
4. THE server-rendered HTML SHALL include JSON-LD `RentalListing` / `Residence` structured data
5. The implementation SHALL NOT block an existing client-side feature (favorites, share, report) — those move into client islands

---

### Requirement 40: Homepage — hero search bar

**User Story:** As a visitor on the homepage, I want to start my search from the hero without clicking through to a separate page, so that I save one navigation.

#### Acceptance Criteria

1. THE homepage hero SHALL replace the current two-button CTA with a search form: `Country | City (type-ahead)` `Property Type` `Min Budget` `Max Budget` `Search →`
2. Submitting the form SHALL navigate to `/search?...` with the matching query params
3. THE form SHALL be fully keyboard-accessible and focus-trapped when the country/city autocomplete is open

---

### Requirement 41: Homepage — popular cities grid

**User Story:** As a visitor unsure where to look, I want a visual grid of the top 8 cities with listing counts, so that I can pick a starting point.

#### Acceptance Criteria

1. THE homepage SHALL render a "Popular cities" grid below the hero, showing 8 cities with: city name, country, listing count, representative photo, average monthly rent
2. THE city cards SHALL link to `/search?city=<name>&country=<name>`
3. THE data SHALL be computed server-side via a Mongo aggregation over the `listings` collection, cached for 30 minutes
4. THE list SHALL be seeded with Berlin, Paris, Amsterdam, Madrid, Barcelona, Lisbon, Rome, Vienna in the absence of live data

---

### Requirement 42: Homepage — trust strip + "how it works" + blog

**User Story:** As a first-time visitor, I want to understand what makes this platform different and how it works, so that I trust it enough to try.

#### Acceptance Criteria

1. THE homepage SHALL render a "trust strip" below the popular-cities grid showing 3 metrics: number of listings, number of verified posters, number of cities covered
2. THE homepage SHALL render a 3-step "How it works" section: (1) Search, (2) Request a viewing, (3) Book with our move-in guarantee
3. THE homepage SHALL render a "Latest from the blog" strip showing 3 newest published articles
4. All four sections SHALL be server-rendered

---

### Requirement 43: Homepage — lighter hero

**User Story:** As a mobile user, I want the homepage to load fast, so that I don't bounce before seeing the content.

#### Acceptance Criteria

1. THE Hero3D Three.js scene SHALL be gated behind `prefers-reduced-motion: no-preference` AND viewport width ≥ 768 px; otherwise a static hero image SHALL render
2. THE Three.js bundle SHALL be code-split and dynamically imported (already done via `dynamic(...)` but verify `loading` boundary)
3. THE homepage LCP target SHALL be < 2.5 s on 4G / moderate CPU

---

### Requirement 44: Listing creation — save as draft

**User Story:** As a poster who's halfway through the 4-step wizard, I want to save my progress and come back later, so that I don't lose everything if I navigate away.

#### Acceptance Criteria

1. THE listing creation form SHALL render a "Save as Draft" button on every step
2. WHEN the user clicks "Save as Draft", THE App SHALL POST the current partial form to `/api/listings` with `status: "draft"`
3. Subsequent drafts by the same user SHALL update the single most-recent draft rather than creating new ones (keyed on `{posterId, status: "draft", _id}`)
4. THE dashboard's "My Listings" page SHALL render drafts in a separate "Drafts" section at the top
5. Clicking a draft SHALL resume the wizard from the correct step

---

### Requirement 45: Listing creation — photo reorder and captions

**User Story:** As a poster, I want to reorder my photos (so the best shot is first) and add optional captions, so that my listing is presented as well as possible.

#### Acceptance Criteria

1. THE photos step of the wizard SHALL render uploaded photos in a grid with drag-to-reorder (via `react-beautiful-dnd` or the platform's native HTML5 drag API)
2. Each photo SHALL have an inline caption input (optional, max 140 chars)
3. THE first photo in the order SHALL be marked "Cover"
4. THE Listing model SHALL extend `photos` from `string[]` to `{ url: string; caption?: string; order: number }[]` (migration: existing string arrays map to `{url, order: i}`)
5. The search-result card and detail-page gallery SHALL continue to use the cover photo first

---

### Requirement 46: Listing creation — rich-text description

**User Story:** As a poster, I want to format my description (headings, lists, links to nearby points of interest), so that it reads well.

#### Acceptance Criteria

1. THE description step SHALL replace the plain textarea with a minimal rich-text editor (ProseMirror-based or TipTap) supporting: bold, italic, H2, H3, bullet list, numbered list, links
2. THE editor SHALL sanitize HTML output (via the existing `src/lib/utils/sanitize.ts`) before submit to prevent XSS
3. THE Listing model's `description` field SHALL continue to accept plain HTML (with schema whitelist)
4. THE listing detail page SHALL render the sanitized HTML with the same prose typography the blog uses

---

### Requirement 47: Listing creation — live preview

**User Story:** As a poster, I want to preview how my listing will look before publishing, so that I can fix issues before real seekers see it.

#### Acceptance Criteria

1. THE final ("tags") step of the wizard SHALL include a "Preview" panel rendering the would-be listing detail page inline
2. THE preview SHALL hot-reload as the poster edits
3. THE preview SHALL be visually distinct from the real listing detail page via a "DRAFT PREVIEW" watermark
4. THE preview SHALL not persist anything server-side

---

### Requirement 48: Listing creation — house rules and lease terms

**User Story:** As a poster, I want to set house rules and lease terms explicitly, so that I don't get inquiries from the wrong profile of tenant.

#### Acceptance Criteria

1. THE listing creation form SHALL add an "About the lease" step (or embed in existing step 1) with fields: `leaseType` (Requirement 3), `minStayMonths`, `maxStayMonths`, `houseRules` multi-select (`no_smoking`, `no_pets`, `couples_ok`, `students_ok`, `professionals_only`, `families_ok`, `women_only`, `men_only` — with Zod-enforced non-discriminatory combinations), `utilitiesIncluded`, `deposit`
2. WHERE `houseRules` includes mutually exclusive values (e.g. `women_only` + `men_only`), THE App SHALL reject the submission with a validation error
3. THE Listing model SHALL add `houseRules: Enum[]` field
4. THE listing detail page SHALL render these as clear labelled chips in the "Lease terms" block

---

### Requirement 49: Listing creation — auto-populate nearby data

**User Story:** As a poster, I want nearby transit and amenities pre-filled after I pick a location, so that I don't have to type them manually.

#### Acceptance Criteria

1. WHEN the poster confirms a lat/lng via the map or address autocomplete, THE App SHALL call an Overpass (OpenStreetMap) query for transit stations within 800 m, and amenities (supermarkets, pharmacies, parks, cafes) within 500 m
2. THE results SHALL be shown in a read-only "Nearby (auto-detected)" section with per-row "Remove" buttons so the poster can curate
3. THE poster MAY manually add entries via "Add nearby place" inputs
4. WHEN the poster saves the listing, THE Listing model's `nearbyTransit` and `nearbyAmenities` arrays are populated (Requirement 27)

---

### Requirement 50: Listing creation — virtual tour and floor plan URLs

**User Story:** As a poster with a Matterport virtual tour or a floor-plan PDF, I want to attach them to my listing, so that remote seekers can evaluate the property fully.

#### Acceptance Criteria

1. THE final step of the wizard SHALL render "Virtual tour URL" (validated: must be HTTPS) and "Floor plan URL" (validated: HTTPS + ends in `.pdf`/`.png`/`.jpg`) inputs
2. The input SHALL accept a direct file upload as an alternative to URL (PDF, PNG, JPG, max 20 MB), uploaded via the existing Supabase Storage service, which returns a URL
3. Both fields SHALL be optional

---

### Requirement 51: Listing creation — image alt text

**User Story:** As a screen-reader user, I want listing photos to have meaningful alt text, so that I can understand what the images show.

#### Acceptance Criteria

1. THE photos step SHALL include an "Alt text" input on each photo (next to the caption from Requirement 45)
2. THE Listing model's photo entries SHALL gain an `alt?: string` field
3. THE search card and detail-page gallery SHALL use `photo.alt` as the `img[alt]`, falling back to `listing.title + " photo " + (i+1)` when empty
4. WHERE a screen reader is detected, THE upload form SHALL prompt to fill alt text before saving

---

### Requirement 52: Favorites — folders, notes, sharing

**User Story:** As a seeker juggling searches across multiple cities, I want to group favorites into folders and add notes, so that I can organize a large shortlist.

#### Acceptance Criteria

1. THE Favorite model SHALL add `folderName: string` (default `"Unfiled"`) and `note: string` (optional, max 500 chars)
2. THE favorites page SHALL render a folder sidebar (left) and the filtered list (right); folders SHALL be user-editable (rename, delete) except the default "Unfiled"
3. Each favorite card SHALL display the user's note if set, plus an inline "Edit" button to update it
4. THE page SHALL support multi-select and a "Move to folder" bulk action
5. THE page SHALL offer a "Share list" button that generates a read-only URL `/favorites/share/<token>` scoped to a single folder
6. The share-link view SHALL be public but anonymized (no personal data of the sharer)
7. Each favorite SHALL render a "Price dropped" badge when the current listing price is lower than the saved-at price (data from `listing.priceHistory`)

---

### Requirement 53: Messaging — translation, attachments, better thread list

**User Story:** As an expat messaging a landlord in a language I don't know well, I want a "translate this message" button and file attachments, so that communication is easier.

#### Acceptance Criteria

1. Each inbound message SHALL render a "Translate" button below the text; clicking it calls a new `/api/messages/translate?messageId=<id>&target=<locale>` endpoint, which uses OpenAI/Anthropic/Google Translate and caches the result
2. Each thread composer SHALL include an attachment button that uploads to Supabase Storage; attachments render as thumbnails (images) or file chips (PDF/other) in the thread
3. Each message SHALL show a read-receipt indicator ("seen 2h ago") using the existing `thread.readBy` map
4. The thread-list item SHALL show the other participant's avatar + language flags, not just their name
5. THE thread composer SHALL support Enter-to-send and Shift+Enter for newline (current: vague)
6. THE empty-state emoji (`💬` at line 175 of messages page) SHALL be replaced with the existing `MessageIcon` SVG
7. THE App SHALL add a per-thread "Mark as scam" quick action that escalates to the admin scam-review queue

---

### Requirement 54: Footer — social links, newsletter, cities

**User Story:** As a visitor about to leave the site, I want the footer to offer me a last-mile conversion (newsletter signup) and ways to discover content I missed.

#### Acceptance Criteria

1. THE footer SHALL add a "Popular cities" column listing the 8 top cities with links to their pre-filtered `/search?city=<name>`
2. THE footer SHALL add a newsletter signup form: `email` + "Subscribe" button; POST to a new `/api/newsletter/subscribe` endpoint
3. THE footer SHALL add social media icons (Instagram, LinkedIn, Twitter/X) linking to placeholder handles in a new `src/lib/siteLinks.ts` constants module
4. THE footer SHALL display an SSL trust badge and "Based in <EU country>" text near the copyright line
5. THE footer SHALL not duplicate the current language + currency selectors on desktop widths ≥ 1024 px (they live in the navbar already)

---

### Requirement 55: Accessibility sweep

**User Story:** As a user with assistive needs, I want every dialog, dropdown, and interactive element to meet WCAG 2.1 AA expectations, so that I can use the app independently.

#### Acceptance Criteria

1. THE Navbar dropdown, mobile drawer, save-search modal, and filter drawer SHALL trap focus and close on Escape
2. Review stars SHALL carry `aria-label="<N> out of 5 stars"`
3. Avatar fallbacks SHALL carry descriptive alt text (user name, not just the initial)
4. Every form input SHALL have an associated `<label>` element (audit pass; the listing creation form has some unlabelled fields)
5. THE App SHALL run an axe-core sweep as part of the sprint runner's standard retrospective and treat any new violations as sprint-blocking

---

### Requirement 56: SSR + SEO for SEO-critical pages

**User Story:** As a platform operator, I want listing detail pages, the homepage, and neighborhood guides to be server-rendered with correct meta tags and structured data, so that organic search delivers users.

#### Acceptance Criteria

1. THE listing detail page SHALL be server-rendered with full metadata (Requirement 39 already covers this)
2. THE page SHALL include JSON-LD `Residence` structured data with `name`, `address`, `geo`, `numberOfRooms`, `floorSize`, `offers.price`, `image[]`
3. THE page SHALL include `<link rel="canonical" href="https://<domain>/listings/<id>">`
4. THE page SHALL include `hreflang` link tags for every supported locale (`en`, `es`, `fr`, `de`, `pt`, `it`)
5. THE homepage SHALL include `Organization` and `WebSite` + `SearchAction` structured data
6. THE neighborhood guide page SHALL include `Place` structured data
7. THE sitemap SHALL include every active listing, every published blog article, and every neighborhood guide — and SHALL split into `sitemap-listings.xml`, `sitemap-blog.xml`, `sitemap-neighborhoods.xml` referenced by a `sitemap.xml` index when total URLs exceed 50,000

---

### Requirement 57: Performance budget

**User Story:** As a mobile user, I want every page to hit a reasonable LCP and INP, so that the app feels responsive.

#### Acceptance Criteria

1. THE App SHALL target LCP < 2.5 s and INP < 200 ms on 4G / moderate-CPU profiles (measured via Lighthouse)
2. THE DevOps sprint-runner Lighthouse run SHALL cover at minimum: `/`, `/search`, `/listings/<id>`, `/users/<id>` — any page scoring below 90 on Performance SHALL fail the sprint success bar
3. THE search page MapView SHALL implement clustering (Requirement 33) to satisfy this budget when result counts are large
4. THE homepage Hero3D SHALL gate behind reduced-motion and viewport (Requirement 43)
5. THE listing detail page photo gallery SHALL lazy-load images below the fold (Requirement 21)

---

### Requirement 58: Observability and feature flags (non-blocking)

**User Story:** As a platform operator, I want structured logs, error tracing, and feature flags, so that I can diagnose production issues and roll out features incrementally.

#### Acceptance Criteria

1. THE App SHALL introduce a `src/lib/api/logger.ts` structured logger (the file exists but usage is sparse) and SHALL replace every `console.warn` / `console.error` in server code paths with logger calls
2. THE App SHALL integrate a lightweight error tracker (Sentry's self-hosted option OR an open-source equivalent like GlitchTip) via env-gated initialization
3. THE App SHALL add a simple feature-flag service backed by MongoDB `FeatureFlag` collection, with a `useFeatureFlag(name)` React hook and a server-side `isFeatureEnabled(name, userId?)` function
4. Feature flags SHALL be the mechanism for rolling out every requirement in this spec incrementally — specifically, Requirements 3 (new listing fields), 6 (energy rating), 33 (map clustering), 35 (email alerts), 53 (message translation)
5. THE admin UI SHALL add a `/admin/feature-flags` page listing current flags with toggle controls

---

### Requirement 59: Branded "move-in guarantee" (Tenant Protection)

**User Story:** As a seeker, I want clear confidence that my payment is protected for 48 hours after move-in, so that I can book remotely without fear of losing money to a mis-described property.

#### Acceptance Criteria

1. THE App SHALL introduce a "Move-in Guarantee" brand — visible on the homepage, listing detail page, and payment confirmation page
2. THE existing escrow payment logic SHALL be documented under this brand with a dedicated `/move-in-guarantee` marketing page explaining the 48-hour window
3. THE listing detail page SHALL render a small shield badge near the price: "Move-in guarantee — 48 hours to flag mismatches"
4. WHEN a seeker moves in and the 48-hour window is active, THE App SHALL send an in-app notification prompting them to confirm the property matches
5. WHEN the 48-hour window elapses without a dispute, THE payment SHALL release to the poster automatically (existing flow, rebranded)
6. WHEN the seeker disputes within the window, THE App SHALL freeze the payment and route it to the admin queue with all evidence (photos, messages)

---

### Requirement 60: Seeker identity verification (KYC)

**User Story:** As a poster, I want to know that the seeker messaging me is who they claim, so that I can share viewing addresses with confidence.

#### Acceptance Criteria

1. THE App SHALL integrate a KYC provider (Stripe Identity, Veriff, or Onfido) gated behind a new env var
2. THE settings page SHALL add a "Verify my identity" action that launches the provider's flow
3. ON completion, THE App SHALL set `user.idVerified = true` and `user.idVerifiedAt = new Date()`
4. THE listing detail page poster card SHALL surface an "ID verified" badge for posters who've completed KYC
5. THE search page SHALL add a "Verified posters only" filter
6. THE App SHALL store only the verification status + timestamp, not the raw ID document (provider retains originals per their ToS)

---

### Requirement 61: Landlord verification (listing authenticity)

**User Story:** As a seeker, I want to know that a listing has been verified by a human (at minimum, via video call), so that I can trust the listing is real.

#### Acceptance Criteria

1. THE App SHALL support two verification tiers: `virtual_verified` (admin has video-called the poster and seen the property via screen-share) and `physical_verified` (an appointed Homechecker-equivalent has visited; out of scope for this pass but modelled)
2. THE Listing model SHALL already include `verifiedAt` + `verifiedBy` from Requirement 3; this requirement extends it with `verificationTier: "virtual" | "physical" | null`
3. THE admin UI SHALL add a "Verify listing" action on each listing detail in `/admin/listings` — opening a small form to record outcome, notes, and a calendar timestamp
4. THE search card and detail page SHALL render a shield icon + "Checked by Apartment Finder" badge when a listing is verified
5. THE search page SHALL add a "Verified listings only" filter

---

### Requirement 62: Document upload (seekers)

**User Story:** As a seeker, I want to upload proof of income, employment letters, and references once, so that I can share them with multiple posters on demand without re-uploading.

#### Acceptance Criteria

1. NOTE: This requirement supplements `competitive-feature-parity` Requirement 3 (Document Upload). Here we extend it with version / tiering:
2. THE TenantDocument model SHALL add `category: enum["proof_of_income","employment_letter","reference","id","bank_statement","credit_report","guarantor_letter"]` (required)
3. THE dashboard documents page SHALL group uploads by category with an upload button per category
4. THE documents page SHALL allow the seeker to share a specific document with a specific poster via a time-limited token URL (already in the existing spec)
5. THE poster's inbox messaging composer SHALL gain a "Request documents" action that lists the required categories; on send, the seeker sees inline document-share CTAs in the thread

---

### Requirement 63: Neighborhood guide — listings embedded + SEO

**User Story:** As a seeker reading a neighborhood guide, I want to see the 6 newest active listings in that neighborhood inline, so that I can go from "this area sounds nice" to "look at these flats" in one click.

#### Acceptance Criteria

1. THE neighborhood guide page SHALL render a "Available now in <neighborhood>" grid of 6 active listings below the main content
2. THE guide page SHALL render JSON-LD `Place` structured data
3. THE guide page SHALL include transit lines and stations listed in a structured block (currently free-form `transitInfo` string) — the model SHALL add `transitLines: {type, line, name}[]`
4. The sitemap SHALL include the guide page (already in existing spec)

---

### Requirement 64: Response-time SLA on posters

**User Story:** As a platform operator, I want to surface posters who reply slowly and prompt them, so that seeker experience doesn't suffer.

#### Acceptance Criteria

1. WHEN a poster's 90-day `responseTimeHours` exceeds 48 hours, THE App SHALL send them a nudge email + in-app notification ("Replying faster attracts more seekers — here's how")
2. WHEN a poster's 90-day `responseRate` drops below 50%, THE App SHALL flag their listings with a "Reply rate low" caveat visible only to admins until they improve (the seeker-facing metrics stay published, unedited)

---

### Requirement 65: Listing — view & inquiry counters

**User Story:** As a poster, I want to see how many people have viewed my listing and how many have inquired, so that I can gauge demand and price accordingly.

#### Acceptance Criteria

1. THE listing detail page SHALL increment `listing.viewCount` server-side once per unique `(userId | ip-hash, day)` combination
2. THE messaging API SHALL increment `listing.inquiryCount` when a new thread for that listing is created
3. THE poster's "My Listings" dashboard SHALL display both counters per listing, plus week-over-week trend arrows
4. Public consumers (seekers) SHALL see the view count only if it exceeds a threshold (e.g. ≥ 50) and SHALL NOT see the inquiry count at all

---

### Requirement 66: Listing — view history "recently viewed in this area"

**User Story:** As a seeker, I want to see what listings are popular right now in my chosen city, so that I can spot hot properties before they're taken.

#### Acceptance Criteria

1. THE search page SHALL render (below or above the standard results) a "Trending this week" strip of up to 4 listings in the selected city, ranked by (`viewCount` this week × 1.0) + (`inquiryCount` this week × 3.0)
2. THE strip SHALL refresh daily via a cron aggregation populating a `listing.trendingScore` field (Mongo pipeline, cached 24 h)

---

### Requirement 67: Admin — feature-flag dashboard

See Requirement 58.5 (consolidated).

---

### Requirement 68: Admin — saved-search insights

**User Story:** As a product manager, I want to see what cities / filters are most commonly saved, so that I can prioritise content and listings for high-intent areas.

#### Acceptance Criteria

1. THE admin analytics page SHALL add a "Saved searches" widget showing the top 10 most-saved cities and top 10 most-used filter combinations
2. THE widget SHALL aggregate over the trailing 30 days of `SavedSearch` documents
3. THE widget SHALL include a CSV export link

---

## Out of scope

- Full Homechecker-style physical verification operations (real-world operations, not software)
- A native mobile app (the PWA path is captured in the existing `webapp-full-audit` spec indirectly; a full RN or Swift/Kotlin app is a separate large programme)
- A "Tenant insurance" financial product (regulatory lift)
- Crime-data overlays outside the UK (data quality varies too much)
- School-catchment overlays outside the UK (same)
- A complete redesign of the homepage hero aesthetics (we're keeping the 3D hero behind the reduced-motion gate)
- Direct integration with banks or PSD2 open-banking rails for proof-of-income verification

## Prioritisation

| Band | Requirements |
|---|---|
| **P0 — critical, do first** | 1 (theme), 2 (city filter), 4 (bedroom semantics), 10 (session shape), 15 (profile dark-mode), 20 (poster card), 25 (edit button) |
| **P1 — core UX / data** | 3 (listing data), 5 (amenities), 6 (energy rating), 7–14 (navbar), 21–28 (listing detail), 29–38 (search) |
| **P2 — competitive parity** | 16–19 (profile), 39–43 (homepage), 44–51 (listing creation), 52 (favorites), 53 (messages) |
| **P3 — trust brand + growth** | 35 (email alerts), 54 (footer), 59 (move-in guarantee), 60 (seeker KYC), 61 (listing verification), 62 (docs), 63 (neighborhood), 64 (SLA), 65 (counters), 66 (trending) |
| **P4 — foundation / platform** | 55 (a11y), 56 (SEO/SSR), 57 (perf budget), 58 (observability), 67 (feature flags), 68 (saved-search insights) |

The tasks document orders implementation accordingly.
