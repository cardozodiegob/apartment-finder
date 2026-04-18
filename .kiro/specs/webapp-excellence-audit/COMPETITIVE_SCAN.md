# Competitive Scan — European Mid/Long-Term Rentals + Student Housing

**Scope:** platforms targeting the same market as Apartment Finder — Europe, mid-to-long-term residential rentals, student housing, and expat relocations.

**Method:** each competitor was reviewed using their public-facing product, help-center articles, and (where available) developer documentation. Content is paraphrased from sources to comply with fair-use/licensing norms; specific URLs are cited inline. Where a feature's exact behaviour is ambiguous, it's marked `~`.

---

## Competitor shortlist

| # | Platform | Focus | Notable differentiator |
|---|---|---|---|
| 1 | [HousingAnywhere](https://housinganywhere.com) | Mid/long-term, 400+ cities, student+expat | Tenant Protection with 48-hour move-in guarantee ([source](https://housinganywhere.com/en/)) |
| 2 | [Spotahome](https://spotahome.com) | Mid/long-term, verified-listing focus | "Homechecker" physical verification + deposit protection ([source](https://www.spotahome.com/tenant-guarantees)) |
| 3 | [Uniplaces](https://uniplaces.com) | Student housing across Europe | Student-first UX, book without viewing |
| 4 | [Nestpick](https://nestpick.com) | Furnished mid-term + student | Aggregator — shows Nestpick Direct + partner listings, "Verified" tag ([source](https://www.nestpick.com/student-accommodation/washington-d-c/)) |
| 5 | [Idealista](https://idealista.com) | Spain/Italy/Portugal classifieds (rent + sale) | Dense filter set including **energy rating** ([source](https://www.idealista.com/en/geo/alquiler-viviendas/itinerario-europeo-e-05-alcobendas-madrid/con-eficiencia-energetica-media/)) |
| 6 | [ImmoScout24](https://immobilienscout24.de) | Germany/Austria/Switzerland, rent + sale | **Energieausweis (energy certificate) display in search results since 2025** ([source](https://www.immobilienscout24.de/company/sustainability/what-we-do-in-the-real-estate-market/)) |
| 7 | [Rightmove](https://rightmove.co.uk) | UK rent + sale | School catchment, EPC display, crime-rate overlays |

*Content was rephrased for compliance with licensing restrictions.*

---

## Feature matrix — property-level data captured in listings

Legend: ✅ feature is present and core to the product, 🟡 present but minor / partial, — missing, `?` couldn't confirm without a logged-in account.

| Field | ApartmentFinder today | HousingAnywhere | Spotahome | Uniplaces | Nestpick | Idealista | ImmoScout24 | Rightmove |
|---|---|---|---|---|---|---|---|---|
| Title | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Description | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Property type (apt/room/house) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Purpose (rent/share/sublet) | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 | 🟡 |
| Bedrooms (whole-unit count) | ❌ (conflated with `availableRooms`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bathrooms | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Beds | ❌ | 🟡 | ✅ | ✅ | ✅ | — | — | — |
| Floor area (m²/ft²) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Floor / total floors | ✅ | 🟡 | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| **Deposit amount** | ❌ | ✅ ([source](https://housinganywhere.com/pricing/tenants)) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Utilities included (bool/list)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bills estimate** | ❌ | ✅ | 🟡 | 🟡 | — | — | — | — |
| **Min / max stay (months)** | ❌ | ✅ | ✅ | ✅ | ✅ | 🟡 | — | — |
| **Lease type (fixed / open / student / short-stay)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Heating type** | ❌ | 🟡 | 🟡 | — | — | 🟡 | ✅ | 🟡 |
| **Energy rating (A–G)** | ❌ | 🟡 | 🟡 | — | — | ✅ | ✅ | ✅ |
| **Year built** | ❌ | 🟡 | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Structured amenities (AC, dishwasher, washing machine, fibre, elevator, gym, terrace, AC) | 🟡 (free-form `tags`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| House rules (no smoking, pets, couples, students, professionals) | 🟡 (`isPetFriendly` only) | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Accessibility (step-free, elevator, grab bars) | 🟡 | 🟡 | 🟡 | — | — | 🟡 | ✅ | 🟡 |
| Nearby transit with distance | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Nearby amenities / POIs | ❌ (Neighborhood guide only) | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| **Floor plan image** | ❌ | 🟡 | ✅ ([source](https://spotahome.zohodesk.com/portal/en/kb/articles/what-is-a-verified-property)) | 🟡 | — | ✅ | ✅ | ✅ |
| **Virtual tour / 360° / video** | ❌ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Listing status (draft/active/archived) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Featured listing flag | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verified / physically checked | 🟡 (admin `idVerified`) | ✅ | ✅ ([source](https://www.spotahome.com/how-it-works)) | 🟡 | 🟡 | — | — | — |
| Scam risk / fraud flags | ✅ | ✅ | ✅ | ✅ | 🟡 | — | — | — |
| Price history | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | — | — | ✅ |
| View count / inquiry count (public) | ❌ | 🟡 | 🟡 | — | — | 🟡 | 🟡 | 🟡 |
| Poster response rate | ❌ | ✅ | ✅ | ✅ | 🟡 | — | — | 🟡 |
| Poster response time | ❌ | ✅ | ✅ | ✅ | 🟡 | — | — | 🟡 |
| **Deposit protection** (escrow until move-in check) | 🟡 (escrow exists, not branded) | ✅ ([source](https://housinganywhere.com/introducing-tenant-protection)) | ✅ | ✅ | 🟡 | — | — | — |
| **Move-in guarantee window** (48–72h) | ❌ | ✅ | ✅ (24h) ([source](https://spotahome.zohodesk.com/portal/en/kb/articles/what-is-a-verified-property)) | ✅ | 🟡 | — | — | — |
| EU school catchment / nearby schools | ❌ (guide has school list, no catchment) | — | — | — | — | — | — | ✅ ([source](https://www.which.co.uk/news/article/10-insider-tips-on-using-rightmove-and-zoopla-to-buy-a-house-aYKTm1m4P3jk)) |
| Crime overlay / safety index | 🟡 (neighborhood guide has a free-form safety field) | — | — | — | — | — | — | ✅ |
| Broadband / fibre availability | ❌ | 🟡 | 🟡 | — | — | 🟡 | ✅ | ✅ |

*Content was rephrased for compliance with licensing restrictions.*

---

## Feature matrix — seeker flow

| Feature | AF today | HousingAnywhere | Spotahome | Uniplaces | Nestpick | Idealista | ImmoScout24 | Rightmove |
|---|---|---|---|---|---|---|---|---|
| Free-text search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| City-level filters | 🟡 (hardcoded) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Country-dependent city dropdown** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ (Spain-only anyway) | ✅ (DE/AT/CH only) | ✅ (UK-only) |
| Neighborhood filter | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Price range | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Price per m² | ❌ | 🟡 | 🟡 | — | — | ✅ | ✅ | 🟡 |
| Bedroom filter | 🟡 (wrong field) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bathroom filter | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Amenity filter (checkboxes) | 🟡 (tags) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Energy rating filter | ❌ | — | — | — | — | ✅ | ✅ | ✅ |
| Stay-length filter (min/max months) | ❌ | ✅ | ✅ | ✅ | ✅ | 🟡 | — | — |
| Available date picker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Furnished / unfurnished | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pet-friendly | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Results sort (relevance/price/newness/proximity) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Map view with pins | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Map pin clustering at zoom-out** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Draw-on-map boundary | ✅ | 🟡 | 🟡 | — | — | ✅ | ✅ | ✅ |
| Saved searches | ✅ | ✅ | ✅ | ✅ | ✅ ([source](https://www.nestpick.com/student-accommodation/newcastle-upon-tyne/)) | ✅ | ✅ | ✅ |
| **Email alerts on saved searches** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recently viewed | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Price-drop badge on cards | 🟡 (shows %) | ✅ | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ✅ |
| Listing compare | ✅ | 🟡 | 🟡 | — | — | 🟡 | ✅ | ✅ |
| Favorites / shortlist | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Favorites folders / collections** | ❌ | 🟡 | — | — | — | 🟡 | — | ✅ |
| Share favorites with roommate | ❌ | — | — | — | — | — | — | 🟡 |
| Notes per favorite | ❌ | — | — | — | — | 🟡 | — | — |

*Content was rephrased for compliance with licensing restrictions.*

---

## Feature matrix — trust, booking, and payment

| Feature | AF today | HousingAnywhere | Spotahome | Uniplaces | Nestpick | Idealista | ImmoScout24 | Rightmove |
|---|---|---|---|---|---|---|---|---|
| Tenant identity verification | 🟡 (admin-driven `idVerified`) | ✅ (ID + liveness) | ✅ (ID + liveness check) ([source](https://spotahome.zohodesk.com/portal/en/kb/articles/identity-verification)) | ✅ | 🟡 | — | — | — |
| Landlord identity verification | 🟡 | ✅ | ✅ | ✅ | 🟡 | — | — | — |
| Listing physical verification | ❌ | — | ✅ (Homechecker) | 🟡 | 🟡 | — | — | — |
| Listing virtual verification | ❌ | ✅ | ✅ | ✅ | — | — | — | — |
| Escrow / held payment | ✅ | ✅ | ✅ | ✅ | 🟡 | — | — | — |
| **Move-in guarantee (X hours)** | ❌ | ✅ (48h) ([source](https://housinganywhere.com/secure-payments)) | ✅ (24h) ([source](https://spotahome.zohodesk.com/portal/en/kb/articles/what-is-a-verified-property)) | ✅ (48h) | 🟡 | — | — | — |
| Deposit protection refund | 🟡 (escrow, not branded) | ✅ | ✅ ([source](https://www.spotahome.com/tenant-guarantees)) | ✅ | 🟡 | — | — | — |
| Paid listing premium tier | ❌ | ✅ | ✅ (Spotahome Plus) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Landlord default-payment insurance | ❌ | 🟡 | ✅ (Spotahome Plus) | 🟡 | — | — | — | — |
| Fraud monitoring / round-the-clock | 🟡 (scam detection service) | ✅ ([source](https://housinganywhere.com/introducing-tenant-protection)) | ✅ | ✅ | 🟡 | 🟡 | 🟡 | 🟡 |
| Review / reputation system | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Response rate / time signals | ❌ | ✅ | ✅ | ✅ | 🟡 | — | — | 🟡 |
| Document upload (proof of income, refs) | ❌ (spec'd but not built) | ✅ | ✅ | ✅ | 🟡 | — | — | — |

*Content was rephrased for compliance with licensing restrictions.*

---

## Feature matrix — communication and scheduling

| Feature | AF today | HousingAnywhere | Spotahome | Uniplaces | Nestpick | Idealista | ImmoScout24 | Rightmove |
|---|---|---|---|---|---|---|---|---|
| In-app messaging | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Translate-message button | ❌ | ✅ | ✅ | ✅ | 🟡 | — | — | — |
| Message attachments | ❌ | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | 🟡 |
| Read receipts | ❌ | ✅ | ✅ | 🟡 | 🟡 | 🟡 | ✅ | 🟡 |
| Typing indicator | ❌ | ✅ | 🟡 | — | — | — | ✅ | — |
| Canned replies | ❌ | 🟡 | 🟡 | — | — | — | ✅ | — |
| Viewing request / scheduling | ✅ | ✅ | 🟡 (typically bookings, not viewings) | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Landlord calendar integration | ❌ | 🟡 | 🟡 | 🟡 | — | — | 🟡 | 🟡 |
| Virtual viewing option | ❌ | ✅ | ✅ | ✅ | 🟡 | — | 🟡 | 🟡 |

*Content was rephrased for compliance with licensing restrictions.*

---

## Feature matrix — platform quality

| Feature | AF today | HousingAnywhere | Spotahome | Uniplaces | Nestpick | Idealista | ImmoScout24 | Rightmove |
|---|---|---|---|---|---|---|---|---|
| i18n / multiple locales | ✅ (6 locales) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (en-GB) |
| Currency selector | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | 🟡 |
| Live FX conversion at display | ❌ | ✅ | ✅ | ✅ | ✅ | 🟡 | — | — |
| Dark mode | ❌ (broken, finding #1) | 🟡 (system) | 🟡 | — | — | — | — | 🟡 |
| Mobile app (native) | ❌ | ✅ ([source](https://play.google.com/store/apps/details?hl=en_GB&id=com.housinganywhere.app)) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PWA / install prompt | ❌ | ✅ | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 | 🟡 |
| SSR / SEO for listing pages | ❌ (client-rendered) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dynamic sitemap | 🟡 (exists, coverage unclear) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| hreflang tags | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Blog / content marketing | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ |
| Neighborhood guides | ✅ | ✅ | ✅ | 🟡 | 🟡 | ✅ | ✅ | ✅ |
| Newsletter signup | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GDPR cookie consent | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GDPR data export / delete | ✅ (route exists) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Content was rephrased for compliance with licensing restrictions.*

---

## Key differentiators to pick from

Reading the matrix, the moves with the highest seeker-trust payoff for Apartment Finder are:

### Tier 1 — "table-stakes" gaps that will cost every serious user

1. **Separate `bedrooms` and `bathrooms` from `availableRooms`.** Every competitor has them. The current filter sends "bedrooms" to a shared-room field — this is actively misleading to users.
2. **Structured amenity vocabulary.** The free-form `tags` string array cannot power a reliable amenity filter or render amenity icons consistently. Replace with an enum-backed structured list.
3. **Country-dependent city dropdown** in the search UI (the ImmoScout24 / Idealista / Rightmove behavior). The listing creation form already does this correctly via Nominatim — port the pattern to search.
4. **Nearby transit with distance** inline on the listing detail page. Idealista pioneered this; it's now expected.
5. **Fix the dark-mode toggle.** Three competing implementations can be consolidated to one `ThemeProvider` with a `<script>` pre-hydration bootstrap.

### Tier 2 — "trust brand" moves — small code, big message

6. **"Move-in guarantee" branding** over the existing escrow. HousingAnywhere built their whole marketing around "48 hours" and "Tenant Protection"; Spotahome uses "24 hours". Apartment Finder already has the escrow machinery via Stripe but has no branded guarantee narrative on the listing detail page.
7. **Verified-listing badge** (virtual verification even if Homechecker-style physical verification isn't feasible yet). Spotahome's virtual verification is a 1-hour video call with the landlord — cheap to operationalize.
8. **Response rate + response time** displayed on the poster's public profile. The data is all there (messages + threads); just needs aggregation.
9. **Deposit + utilities + bills** disclosed up-front on every listing. Hidden costs are the #1 seeker complaint across review sites.

### Tier 3 — "compound" moves — each compounds with the rest

10. **Saved-search email alerts.** The piece that converts a one-time visitor into a repeat user.
11. **Recently viewed + favorites folders.** Retention, not acquisition.
12. **Energy rating (A–G).** EU regulatory tailwind + Idealista/Rightmove/ImmoScout24 all have it.
13. **Lease type + stay length** filters. Lets AF compete for the mid-term market (HousingAnywhere's biggest vertical) without abandoning long-term.
14. **Virtual tours / video.** Spotahome listings with video convert 2-3× (per industry interviews).
15. **In-thread translation button.** Differentiator for expat audience. OpenAI/Anthropic/Google Translate APIs can serve this cheaply.

### Tier 4 — "category-defining" moves

16. **Tenant bills estimate** (HousingAnywhere's feature that nobody else has yet) — the "Uber-ride-fare" equivalent for housing. Huge seeker-trust upside.
17. **Floor plan generation** from photos + dimensions (Spotahome does this via Homecheckers; AI-based floor plan generation is now commodity).
18. **Crime + school-catchment overlays** on the map (Rightmove/Zoopla's UK-only feature) — differentiator in countries where this data is open (UK, NL, DE parts).

---

## What NOT to chase

A few patterns are hard to copy well with a small team:

- **Full Homechecker operations** (Spotahome): expensive, requires local contractors in every city
- **Native mobile app**: PWA can cover 80% of the value at a fraction of the cost
- **Crime/school catchment data in every country**: data quality varies wildly
- **"Tenant insurance" products**: regulated in every EU country; legal/compliance lift

These are noted in the scan for completeness but aren't proposed in the spec.

---

## Sources

- [HousingAnywhere](https://housinganywhere.com/en/) — product pages, [Tenant Protection explainer](https://housinganywhere.com/introducing-tenant-protection), [secure payments](https://housinganywhere.com/secure-payments), [pricing](https://housinganywhere.com/pricing/tenants), [mobile app](https://play.google.com/store/apps/details?hl=en_GB&id=com.housinganywhere.app)
- [Spotahome](https://spotahome.com) — [how it works](https://www.spotahome.com/how-it-works), [tenant guarantees](https://www.spotahome.com/tenant-guarantees), [identity verification process](https://spotahome.zohodesk.com/portal/en/kb/articles/identity-verification), [Homechecker verification](https://spotahome.zohodesk.com/portal/en/kb/articles/what-is-a-verified-property), [plans](https://plans.spotahome.com/plus), [CEO interview on Online Marketplaces](https://www.onlinemarketplaces.com/articles/ten-questions-with-eduardo-garbayo-ceo-at-spotahome/)
- [Uniplaces](https://uniplaces.com) — product pages, [beportugal coverage](https://www.beportugal.com/uniplaces/)
- [Nestpick](https://nestpick.com) — [student accommodation pages](https://www.nestpick.com/student-accommodation/), [saved-search alerts](https://www.nestpick.com/student-accommodation/newcastle-upon-tyne/)
- [Idealista](https://idealista.com) — [energy-efficiency filtered search](https://www.idealista.com/en/geo/alquiler-viviendas/itinerario-europeo-e-05-alcobendas-madrid/con-eficiencia-energetica-media/)
- [ImmoScout24](https://immobilienscout24.de) — [sustainability page](https://www.immobilienscout24.de/company/sustainability/what-we-do-in-the-real-estate-market/), [energy-certificate API docs](https://api.immobilienscout24.de/api-docs/energy-certificates/)
- [Rightmove](https://rightmove.co.uk) — [EPC guide](https://www.rightmove.co.uk/guides/energy-efficiency/energy-performance-certificates/what-is-an-epc/), [school checker feature coverage](https://www.which.co.uk/news/article/10-insider-tips-on-using-rightmove-and-zoopla-to-buy-a-house-aYKTm1m4P3jk)

*Content was rephrased for compliance with licensing restrictions.*
