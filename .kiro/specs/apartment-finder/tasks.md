# Implementation Plan: Apartment Finder

## Overview

Build a full-stack Next.js application for expats in Europe to find rental housing safely. The implementation proceeds incrementally: project scaffolding → data layer → core services → UI shell → feature modules → integration. Each task builds on previous work, and property-based tests validate correctness properties from the design document.

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Initialize Next.js project with App Router, Tailwind CSS, and core dependencies
    - Run `npx create-next-app@latest` with TypeScript, Tailwind CSS, App Router, ESLint
    - Install dependencies: `mongoose`, `@supabase/supabase-js`, `@reduxjs/toolkit`, `react-redux`, `next-intl`, `stripe`, `zod`, `resend`, `leaflet`, `react-leaflet`
    - Install dev dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, `msw`, `@types/leaflet`
    - Configure `vitest.config.ts` with path aliases and React Testing Library setup
    - Create `.env.local.example` with all required env vars (Supabase URL/key, MongoDB URI, Stripe keys, Resend API key, Exchange Rate API key, Mapbox token, initial admin credentials)
    - _Requirements: 10.8, 13.1, 13.2_

  - [x] 1.2 Set up Tailwind CSS theme with glassmorphism tokens and dark/light mode
    - Extend `tailwind.config.ts` with custom colors (white, dark blue palette), glassmorphism utilities (backdrop-blur, bg-opacity), and dark mode class strategy
    - Create `globals.css` with base styles, CSS custom properties for theme tokens, and glassmorphism component classes
    - _Requirements: 10.1, 10.5, 10.8_

  - [x] 1.3 Set up internationalization with next-intl
    - Create `i18n.ts` config with supported locales: `en`, `es`, `fr`, `de`, `pt`, `it`
    - Create message files under `messages/{locale}.json` with initial keys for common UI strings
    - Configure `middleware.ts` for locale detection from `Accept-Language` header
    - Set up `next-intl` provider in root layout
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.4 Set up MongoDB connection and Mongoose base configuration
    - Create `lib/db/connection.ts` with singleton MongoDB connection pattern for Next.js
    - Create Mongoose schemas and models: `User`, `Listing`, `Review`, `Payment`, `Report`, `Notification`, `ConsentLog` matching design data models
    - Add MongoDB indexes: compound on `(status, propertyType, monthlyRent)`, text on `(title, description, tags)`, 2dsphere on `location`
    - _Requirements: 2.1, 3.1, 3.3, 3.5_

  - [x] 1.5 Set up Supabase client and auth helpers
    - Create `lib/supabase/client.ts` (browser client) and `lib/supabase/server.ts` (server client)
    - Configure Supabase Storage bucket for listing photos
    - _Requirements: 1.1, 1.2, 2.3_

  - [x] 1.6 Set up Redux Toolkit store and React Context providers
    - Create Redux store with slices: `sessionSlice`, `listingsSlice`, `filtersSlice`, `paymentsSlice`
    - Create React Context providers: `ThemeContext`, `LocaleContext`, `NotificationPanelContext`
    - Create `StoreProvider` wrapper component for the root layout
    - Configure state persistence for session and filter selections using cookies/localStorage
    - _Requirements: 13.1, 13.2, 13.3, 13.4_


  - [x]* 1.7 Write property test for Redux state persistence round-trip
    - **Property 36: Redux state persistence round-trip**
    - Generate Redux state snapshots with session and filter data; serialize and restore; verify equivalence
    - **Validates: Requirements 13.3**

- [x] 2. Checkpoint - Verify project scaffolding
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Authentication service and API routes
  - [x] 3.1 Implement Auth Service (`lib/services/auth.ts`)
    - Implement `register()`, `login()`, `loginWithOAuth()`, `verifyEmail()`, `requestPasswordReset()`, `resetPassword()`, `logout()`, `getSession()`
    - Implement account lockout logic: track failed attempts (in-memory Map or Redis-like store), lock after 3 consecutive failures for 15 minutes
    - Add Zod validation schemas for registration and login inputs
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8_

  - [x] 3.2 Create auth API routes
    - `POST /api/auth/register` — registration with validation
    - `POST /api/auth/login` — login with lockout check
    - `POST /api/auth/logout` — session termination
    - `POST /api/auth/reset-password` — password reset request
    - `POST /api/auth/verify-email` — email verification
    - `GET /api/auth/session` — current session
    - Wrap all routes in try-catch with standardized `ApiError` response format
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.8_

  - [x]* 3.3 Write property test for registration creates verified-pending account
    - **Property 1: Registration creates verified-pending account**
    - Generate random valid registration inputs; verify account creation with `verified = false`; verify duplicate email rejection
    - **Validates: Requirements 1.2, 1.3**

  - [x]* 3.4 Write property test for account lockout after consecutive failures
    - **Property 2: Account lockout after consecutive failures**
    - Generate sequences of 3+ invalid login attempts; verify lockout; verify valid credentials rejected during lockout
    - **Validates: Requirements 1.6**

  - [x] 3.5 Create auth UI pages
    - Build `/register` page with form: email, password, full name, preferred language selector
    - Build `/login` page with email/password form and OAuth buttons (Google, GitHub)
    - Build `/reset-password` page with email input
    - Apply glassmorphism card styling, dark mode support, responsive layout
    - Add inline field validation errors using Zod
    - _Requirements: 1.1, 1.7, 10.1, 10.3_

- [x] 4. Listing service, scam detection, and listing UI
  - [x] 4.1 Implement Listing Service (`lib/services/listings.ts`)
    - Implement `create()`, `update()`, `publish()`, `delete()`, `getById()`, `getByUser()`, `uploadPhotos()`
    - Photo validation: reject files > 5MB or not JPEG/PNG/WebP
    - Photo upload to Supabase Storage with perceptual hash generation (pHash)
    - Status management: draft → active (via publish), active → archived (via delete)
    - Enforce ownership checks on update/delete/publish
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x]* 4.2 Write property test for photo upload validation
    - **Property 3: Photo upload validation**
    - Generate files with random sizes and MIME types; verify accept/reject logic matches size < 5MB AND format in {JPEG, PNG, WebP}
    - **Validates: Requirements 2.3**

  - [x]* 4.3 Write property test for listing visibility by status
    - **Property 4: Listing visibility is determined by status**
    - Generate listings with random statuses and user IDs; verify draft visible only to owner; verify active visible to all
    - **Validates: Requirements 2.5, 2.6**

  - [x]* 4.4 Write property test for listing deletion archives correctly
    - **Property 5: Listing deletion removes from search but preserves archive**
    - Generate active listings; call delete; verify not in search results; verify record exists with status "archived"
    - **Validates: Requirements 2.8**

  - [x] 4.5 Implement Scam Detection Module (`lib/services/scam-detection.ts`)
    - Implement `analyzeListing()`, `checkDuplicatePhotos()`, `checkPricingAnomaly()`
    - Duplicate photo detection via perceptual hash comparison across active listings
    - Pricing anomaly detection: flag listings priced significantly below area median
    - NLP keyword scanning for known scam phrases
    - Return `ScamAnalysisResult` with risk level and flags
    - _Requirements: 6.1, 6.2, 6.8_

  - [x]* 4.6 Write property test for scam detection holds high-risk listings
    - **Property 17: Scam detection holds high-risk listings**
    - Generate listings with varying risk signals; verify high-risk listings get status "under_review" instead of "active"
    - **Validates: Requirements 6.1, 6.2**

  - [x]* 4.7 Write property test for duplicate photo detection
    - **Property 18: Duplicate photo detection across listings**
    - Generate photo hash sets with known duplicates across different posters; verify detection flags
    - **Validates: Requirements 6.8**

  - [x] 4.8 Create listing API routes
    - `POST /api/listings` — create listing (authenticated, poster only)
    - `PUT /api/listings/[id]` — update listing (owner only)
    - `POST /api/listings/[id]/publish` — publish listing (triggers scam detection)
    - `DELETE /api/listings/[id]` — archive listing (owner only)
    - `GET /api/listings/[id]` — get listing (visibility check based on status)
    - `GET /api/listings/user/[userId]` — get user's listings
    - `POST /api/listings/[id]/photos` — upload photos with validation
    - _Requirements: 2.1, 2.3, 2.5, 2.6, 2.7, 2.8_

  - [x] 4.9 Create listing UI pages
    - Build `/listings/new` page with multi-step form: details, photos, address, tags
    - Build `/listings/[id]` detail page with photo gallery, poster trust score, 3 recent reviews, map pin
    - Build `/listings/[id]/edit` page reusing form components
    - Build `/dashboard/listings` page showing poster's own listings with status badges
    - Support shared accommodation fields (current occupants, available rooms) when toggled
    - Apply glassmorphism cards, placeholder images for missing photos, responsive grid
    - _Requirements: 2.1, 2.2, 2.4, 5.4, 5.8, 10.1, 10.3, 10.4, 11.1, 11.3_


- [x] 5. Checkpoint - Verify auth and listings
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Search, filter, and map integration
  - [x] 6.1 Implement Search & Filter Service (`lib/services/search.ts`)
    - Implement `search()` with multi-criteria filtering: property type, price range, bedrooms, available date, tags, purpose
    - Implement `searchWithinBoundary()` with MongoDB 2dsphere geo query for polygon containment
    - Implement full-text search across title, description, tags using MongoDB text index
    - Apply AND logic for combined filters
    - Return paginated results with total count
    - Set 5-second query timeout with partial results fallback
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x]* 6.2 Write property test for filter results satisfy all criteria
    - **Property 6: Filter results satisfy all applied filter criteria**
    - Generate listings and random filter combinations; verify every result satisfies all active filters; verify total count matches
    - **Validates: Requirements 3.1, 3.4, 3.7**

  - [x]* 6.3 Write property test for full-text search matches
    - **Property 7: Full-text search matches titles, descriptions, and tags**
    - Generate listings with known text; search for substrings; verify every result contains query term in title, description, or tags
    - **Validates: Requirements 3.3**

  - [x]* 6.4 Write property test for geographic boundary containment
    - **Property 8: Geographic boundary filter containment**
    - Generate random polygons and listing coordinates; verify every returned listing has coordinates within the polygon
    - **Validates: Requirements 3.5**

  - [x]* 6.5 Write property test for filter serialization round-trip
    - **Property 9: Filter serialization round-trip**
    - Generate random filter states; serialize to URL query params; deserialize back; verify equivalence
    - **Validates: Requirements 3.9**

  - [x]* 6.6 Write property test for clear filters restores full set
    - **Property 10: Clear filters restores full listing set**
    - Generate random filters; apply then clear; verify result matches unfiltered query
    - **Validates: Requirements 3.8**

  - [x] 6.7 Create search API routes
    - `GET /api/search` — search with query params for all filter criteria
    - `POST /api/search/boundary` — search within geographic boundary (GeoJSON polygon in body)
    - Validate and sanitize all query params via Zod; silently ignore invalid params
    - Serialize filter state to URL query parameters for shareable links
    - _Requirements: 3.1, 3.5, 3.9_

  - [x] 6.8 Create search and filter UI
    - Build `/search` page with filter sidebar: property type, price range slider, bedrooms, date picker, tags, purpose, shared accommodation toggle
    - Integrate Leaflet map with draw-polygon tool for geographic boundary filtering
    - Display listing results in responsive grid with total count badge
    - Implement filter persistence in URL query params
    - Add "Clear all filters" button that resets to all active listings
    - Add city/neighborhood dropdown for predefined location filtering
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7, 3.8, 3.9, 10.3_

- [x] 7. Checkpoint - Verify search and filter
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Internationalization, currency conversion, and locale formatting
  - [x] 8.1 Implement Currency Converter Service (`lib/services/currency.ts`)
    - Implement `convert()`, `getRates()`, `formatPrice()`
    - Fetch exchange rates from public API with 24-hour cache (in-memory or Redis)
    - Support all 10 currencies: EUR, USD, GBP, CHF, SEK, NOK, DKK, PLN, CZK, BRL
    - Format prices using `Intl.NumberFormat` with locale-aware currency symbol placement
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

  - [x]* 8.2 Write property test for currency conversion round-trip consistency
    - **Property 11: Currency conversion round-trip consistency**
    - Generate amounts and currency pairs; verify dual display shows original and correctly converted amount using rates ≤ 24 hours old
    - **Validates: Requirements 4.4, 4.5**

  - [x]* 8.3 Write property test for locale-aware formatting
    - **Property 12: Locale-aware formatting**
    - Generate values and locales; verify formatted output matches `Intl` conventions for decimal separators, date ordering, currency symbols
    - **Validates: Requirements 4.7**

  - [x] 8.4 Create currency API route and integrate i18n into UI
    - `GET /api/currency/rates?base=EUR` — get exchange rates
    - Add language selector component in navigation bar (no-reload switching via next-intl)
    - Add currency selector component in user preferences
    - Display listing prices with dual currency (original + preferred)
    - Format all dates, numbers, and currency symbols per selected locale
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_


- [x] 9. Trust, recommendation, and review system
  - [x] 9.1 Implement Trust & Recommendation Engine (`lib/services/trust.ts`)
    - Implement `calculateScore()` with time-decay formula: `score = Σ(rating_i × e^(-0.01 × age_days)) / Σ(e^(-0.01 × age_days)) × completeness_factor`
    - Implement `submitReview()` — validate one review per party per transaction
    - Implement `getReviewsForUser()` — return reviews sorted by recency
    - Implement `getUserBadge()` — "new_user" if < 3 transactions, "trusted" or "flagged" otherwise
    - Implement `flagLowTrustUser()` — flag account for admin review, add warning label to listings
    - Score bounded between 0 and 5; completeness_factor 0.5–1.0 based on profile fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [x]* 9.2 Write property test for trust score with time-decay
    - **Property 13: Trust score calculation with time-decay weighting**
    - Generate review sequences with timestamps; verify recent reviews weighted higher; verify score bounded [0, 5]; verify new high rating never decreases score
    - **Validates: Requirements 5.1, 5.7**

  - [x]* 9.3 Write property test for new user badge threshold
    - **Property 14: New user badge threshold**
    - Generate users with random transaction counts; verify "New User" badge for < 3 transactions; verify numeric score for ≥ 3
    - **Validates: Requirements 5.5**

  - [x]* 9.4 Write property test for low trust flagging
    - **Property 15: Low trust score triggers flagging**
    - Generate users with scores around threshold; verify flagging and warning label on listings
    - **Validates: Requirements 5.6**

  - [x]* 9.5 Write property test for review submission updates trust score
    - **Property 16: Review submission updates trust score**
    - Generate completed transactions and reviews; verify score recalculation; verify 3 most recent reviews retrievable
    - **Validates: Requirements 5.2, 5.3, 5.8**

  - [x] 9.6 Create trust/review API routes and UI components
    - `POST /api/reviews` — submit review (authenticated, after completed transaction)
    - `GET /api/users/[id]/reviews` — get user reviews
    - `GET /api/users/[id]/trust` — get trust score and badge
    - Build trust score badge component (displays score or "New User" badge)
    - Build review card component and review submission form
    - Display 3 most recent reviews on listing detail page
    - Display trust score on user profile and listing cards
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.8_

- [x] 10. Checkpoint - Verify trust and reviews
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Report system and scam prevention UI
  - [x] 11.1 Implement Report Service (`lib/services/reports.ts`)
    - Implement report creation with predefined categories: "suspected_scam", "misleading_information", "harassment", "other"
    - Set reported listing status to "under_review" while report is pending
    - Track confirmed scam reports per poster; suspend account and remove listings at 3+ confirmed reports
    - Implement report resolution with notification to both parties
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x]* 11.2 Write property test for report creation and notification
    - **Property 19: Report creation and notification**
    - Generate reports with valid categories; verify ticket creation; verify "under review" label on reported listing
    - **Validates: Requirements 6.3, 6.5**

  - [x]* 11.3 Write property test for scam report accumulation suspends account
    - **Property 20: Scam report accumulation suspends account**
    - Generate posters with varying confirmed report counts; verify suspension at 3+; verify listings removed from search
    - **Validates: Requirements 6.7**

  - [x] 11.4 Create report API routes and UI
    - `POST /api/reports` — create report (authenticated)
    - `GET /api/reports` — admin: list reports sorted by priority (oldest first)
    - `PUT /api/reports/[id]/resolve` — admin: resolve report
    - Build report modal with category selector and description field
    - Display "under review" label on reported listings
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [x] 12. Payment system with escrow and dual-party verification
  - [x] 12.1 Implement Payment Service (`lib/services/payments.ts`)
    - Implement `initiatePayment()` — create Stripe PaymentIntent with `capture_method: 'manual'`, create pending payment record
    - Implement `confirmPayment()` — track seeker/poster confirmations; capture funds only when both confirm
    - Implement `cancelPayment()` — cancel PaymentIntent, update status
    - Implement `raiseDispute()` — freeze escrowed funds, create dispute ticket
    - Implement `getPaymentSummary()` — display amount in processing currency and user's preferred currency
    - Implement 72-hour auto-cancel via scheduled check (API route or cron)
    - Support payment currencies: EUR, GBP, CHF, USD
    - Generate receipt URL after completion
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x]* 12.2 Write property test for dual-party payment confirmation
    - **Property 21: Dual-party payment confirmation**
    - Generate payment flows with different confirmation sequences; verify funds transferred only when both confirm; verify auto-cancel at 72h with single confirmation
    - **Validates: Requirements 7.2, 7.3**

  - [x]* 12.3 Write property test for payment escrow invariant
    - **Property 22: Payment escrow invariant**
    - Generate payments in various states; verify funds remain in escrow until both-party confirmation or cancellation
    - **Validates: Requirements 7.1, 7.4**

  - [x]* 12.4 Write property test for payment dispute freezes funds
    - **Property 23: Payment dispute freezes funds**
    - Generate payments and dispute actions; verify fund freeze and dispute ticket creation; verify status transitions to "disputed"
    - **Validates: Requirements 7.6**

  - [x]* 12.5 Write property test for payment receipt generation
    - **Property 24: Payment receipt generation**
    - Generate completed payments; verify receipt accessible to both parties; verify dual currency display
    - **Validates: Requirements 7.5, 7.8**

  - [x] 12.6 Create payment API routes and UI
    - `POST /api/payments` — initiate payment (seeker, authenticated)
    - `POST /api/payments/[id]/confirm` — confirm payment (seeker or poster)
    - `POST /api/payments/[id]/cancel` — cancel payment
    - `POST /api/payments/[id]/dispute` — raise dispute
    - `GET /api/payments/[id]` — get payment summary with dual currency
    - Build payment initiation form on listing detail page
    - Build payment status page with confirmation buttons for both parties
    - Build receipt view with dual currency display
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.8_

- [x] 13. Checkpoint - Verify reports and payments
  - Ensure all tests pass, ask the user if questions arise.


- [x] 14. Notification system
  - [x] 14.1 Implement Notification Service (`lib/services/notifications.ts`)
    - Implement `send()` — create in-app notification in MongoDB; deliver via Supabase Realtime within 30 seconds
    - Implement `getForUser()` — fetch notifications with optional unread filter
    - Implement `markAsRead()`, `dismiss()` — update notification state
    - Implement `updatePreferences()` — store per-user notification preferences
    - Send email via Resend for critical events: payment confirmations, security events, report outcomes
    - Respect user notification preferences for all deliveries
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x]* 14.2 Write property test for notification delivery by event type
    - **Property 34: Notification delivery by event type and channel**
    - Generate notification-triggering events of various types; verify in-app delivery for all; verify email for critical events
    - **Validates: Requirements 12.1, 12.3**

  - [x]* 14.3 Write property test for notification preference enforcement
    - **Property 35: Notification preference enforcement**
    - Generate preference updates and subsequent events; verify disabled types are not delivered
    - **Validates: Requirements 12.4**

  - [x] 14.4 Create notification API routes and UI
    - `GET /api/notifications` — get user notifications (authenticated)
    - `PUT /api/notifications/[id]/read` — mark as read
    - `PUT /api/notifications/[id]/dismiss` — dismiss notification
    - `PUT /api/notifications/preferences` — update preferences
    - Build notification center panel (slide-out or dropdown) with unread count badge
    - Build notification preferences page
    - _Requirements: 12.1, 12.4, 12.5_

- [x] 15. Shared accommodation features
  - [x] 15.1 Implement shared accommodation listing and roommate requests
    - Add "looking for roommates" toggle to listing creation form
    - Add current occupants and available rooms fields (shown when toggle is on)
    - Add dedicated "shared accommodation" filter in search sidebar
    - Implement roommate interest request: `POST /api/listings/[id]/roommate-request`
    - Notify poster via in-app and email when roommate request received
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x]* 15.2 Write property test for shared accommodation listing attributes
    - **Property 33: Shared accommodation listing attributes**
    - Generate listings with roommate flag; verify detail view shows occupants/rooms; verify shared filter returns only flagged listings
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [x] 16. GDPR compliance and privacy module
  - [x] 16.1 Implement Privacy/GDPR Module (`lib/services/privacy.ts`)
    - Implement `showConsentBanner()` — check consent state, return banner config
    - Implement `updateConsent()` — record consent with timestamp in ConsentLog
    - Implement `exportUserData()` — gather all user data (profile, listings, reviews, payments, consent) into JSON
    - Implement `deleteUserData()` — delete all personal data, send confirmation email
    - Implement `getConsentLog()` — return timestamped consent history
    - Block non-essential cookies until explicit consent
    - Stop processing for withdrawn consent purposes within 24 hours
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x]* 16.2 Write property test for no non-essential cookies without consent
    - **Property 28: No non-essential cookies without consent**
    - Generate users with various consent states; verify no non-essential cookies set without consent
    - **Validates: Requirements 9.2**

  - [x]* 16.3 Write property test for user data export completeness
    - **Property 29: User data export completeness**
    - Generate users with various data; verify export JSON contains all personal data (profile, listings, reviews, payments, consent)
    - **Validates: Requirements 9.4**

  - [x]* 16.4 Write property test for user data deletion completeness
    - **Property 30: User data deletion completeness**
    - Generate users; request deletion; verify no personal data remains in database
    - **Validates: Requirements 9.5**

  - [x]* 16.5 Write property test for consent log integrity
    - **Property 31: Consent log integrity**
    - Generate consent action sequences; verify timestamped log entries; verify withdrawn consent stops processing
    - **Validates: Requirements 9.6, 9.7**

  - [x] 16.6 Create privacy API routes and UI
    - `POST /api/privacy/consent` — update consent preferences
    - `GET /api/privacy/export` — request data export (authenticated)
    - `DELETE /api/privacy/data` — request data deletion (authenticated)
    - `GET /api/privacy/consent-log` — get consent history
    - Build cookie consent banner component (accept, reject, customize)
    - Build privacy settings page with data export and deletion buttons
    - Create `/privacy-policy` static page
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 17. Checkpoint - Verify notifications, shared accommodation, and GDPR
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Admin panel
  - [x] 18.1 Implement admin middleware and initial admin seeding
    - Create admin auth middleware that rejects non-admin users with 403
    - Implement initial admin account creation from environment variables on first deployment
    - _Requirements: 8.1, 8.8_

  - [x]* 18.2 Write property test for admin role access restriction
    - **Property 27: Admin role access restriction**
    - Generate users with random roles; verify all non-admin requests to admin endpoints are rejected with authorization error
    - **Validates: Requirements 8.8**

  - [x] 18.3 Implement admin API routes
    - `GET /api/admin/dashboard` — summary metrics (total users, active listings, pending reports, recent transactions)
    - `GET /api/admin/users` — user management with search, suspend, reactivate
    - `PUT /api/admin/users/[id]/suspend` — suspend user
    - `PUT /api/admin/users/[id]/reactivate` — reactivate user
    - `GET /api/admin/listings` — listing management with search, approve, remove
    - `PUT /api/admin/listings/[id]/approve` — approve held listing
    - `DELETE /api/admin/listings/[id]` — remove listing
    - `GET /api/admin/reports` — report queue sorted by priority (oldest first)
    - `PUT /api/admin/reports/[id]/resolve` — resolve report with reason
    - Log all moderation actions with admin ID, timestamp, and reason
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x]* 18.4 Write property test for admin report queue ordering
    - **Property 25: Admin report queue ordering**
    - Generate reports with random timestamps; verify queue sorted with oldest unresolved first
    - **Validates: Requirements 8.6**

  - [x]* 18.5 Write property test for moderation action audit logging
    - **Property 26: Moderation action audit logging**
    - Generate admin actions; verify log entry contains admin ID, timestamp, and reason; verify log is immutable and queryable
    - **Validates: Requirements 8.7**

  - [x] 18.6 Create admin panel UI
    - Build `/admin` dashboard page with summary metric cards
    - Build `/admin/users` page with user table, search, suspend/reactivate actions
    - Build `/admin/listings` page with listing table, approve/remove actions
    - Build `/admin/reports` page with report queue, full report history view, resolve action
    - Display user trust score and transaction history in report review view
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 19. UI shell, homepage, and visual polish
  - [x] 19.1 Build application shell and navigation
    - Create root layout with navigation bar: logo, search, language selector, currency selector, notification bell, user menu
    - Implement dark/light mode toggle with theme persistence via React Context
    - Build responsive mobile navigation (hamburger menu)
    - Ensure all navigation elements work across 320px–2560px viewports
    - _Requirements: 10.1, 10.3, 10.5, 10.8_

  - [x] 19.2 Build homepage with hero section and parallax
    - Create hero section with parallax scrolling effect, glassmorphism overlay, and CTA
    - Display featured listings grid below hero
    - Add placeholder images for hero and listing cards when no images available
    - Implement SSR for initial page content (< 2 second load target)
    - _Requirements: 10.2, 10.4, 10.7_

  - [x]* 19.3 Write property test for placeholder image fallback
    - **Property 32: Placeholder image fallback**
    - Generate listings with and without photos; verify placeholder rendered when no photos available; verify no broken images
    - **Validates: Requirements 10.4**

- [x] 20. Integration wiring and final polish
  - [x] 20.1 Wire all services together end-to-end
    - Connect listing publish flow: create → scam detection → publish/hold → notification
    - Connect payment flow: initiate → dual confirm → escrow release → receipt → review prompt
    - Connect report flow: submit → notification → admin review → resolution → notification
    - Connect trust flow: review submitted → score recalculated → badge updated → listing display updated
    - Ensure all notification triggers fire correctly across all flows
    - _Requirements: 2.6, 5.2, 6.1, 6.3, 7.2, 12.1_

  - [x] 20.2 Add rate limiting and error boundary middleware
    - Implement rate limiting middleware: 100 req/min for public routes, 300 req/min for authenticated routes
    - Add React Error Boundaries at page and component level
    - Add structured JSON logging with correlation IDs
    - Ensure graceful degradation when external services are unavailable
    - _Requirements: 10.7_

  - [x]* 20.3 Write integration tests for critical flows
    - Test auth flow: register → verify → login → session
    - Test listing lifecycle: create → publish (scam check) → search → archive
    - Test payment flow: initiate → dual confirm → receipt
    - Test report flow: submit → admin review → resolve → notification
    - _Requirements: 1.2, 2.6, 7.2, 6.3_

- [x] 21. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The tech stack is: Next.js App Router, TypeScript, Tailwind CSS, MongoDB/Mongoose, Supabase, Redux Toolkit, next-intl, Stripe, Leaflet, Vitest, fast-check
