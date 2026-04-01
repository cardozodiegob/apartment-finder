# Implementation Plan: Webapp Full Audit

## Overview

Comprehensive audit implementation for the Apartment Finder webapp covering security hardening, session management, database optimization, new features (favorites, messaging, profiles, listing expiration), email infrastructure, admin tooling, and UI/UX polish. Tasks are ordered so each builds on the previous, starting with core security/session infrastructure and ending with UI components.

## Tasks

- [x] 1. Session resolver and token refresh infrastructure
  - [x] 1.1 Create `src/lib/api/session.ts` with `getSessionUser`, `requireSessionUser`, `requireAdmin`, and `requireActiveUser` functions
    - Extract user from `sb-access-token` cookie via Supabase `getUser`
    - On expired token, use `sb-refresh-token` to call `supabaseAdmin.auth.refreshSession`
    - Set new cookies on successful refresh, delete both on failure
    - Look up MongoDB User record and return `SessionUser` object
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x]* 1.2 Write property tests for session resolver
    - **Property 1: Token refresh always updates both cookies or deletes both — never leaves partial state**
    - **Validates: Requirements 1.2, 1.3**
  - [x]* 1.3 Write unit tests for session resolver
    - Test expired access token with valid refresh token returns user
    - Test expired refresh token returns null and clears cookies
    - Test missing cookies returns null
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Derive user identity from session cookies across all API routes
  - [x] 2.1 Refactor admin API routes to use `requireAdmin()` instead of client-supplied `adminId`
    - Update `src/app/api/admin/dashboard/route.ts`, `src/app/api/admin/listings/route.ts`, `src/app/api/admin/reports/route.ts`, `src/app/api/admin/users/route.ts` and all sub-routes
    - Remove any `adminId` from query params or body parsing
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Refactor listing routes to use `requireActiveUser()` for write operations
    - Update create, update, delete, publish routes in `src/app/api/listings/`
    - Derive `posterId` from session instead of request body
    - _Requirements: 2.4_
  - [x] 2.3 Refactor notification routes to use `requireSessionUser()`
    - Update `src/app/api/notifications/route.ts` and sub-routes (read, dismiss, preferences)
    - Ignore any `userId` query parameter
    - _Requirements: 2.5, 8.1, 8.2, 8.3_
  - [x] 2.4 Refactor payment routes to use `requireActiveUser()`
    - Update confirm, cancel, dispute routes in `src/app/api/payments/`
    - _Requirements: 2.6_
  - [x] 2.5 Protect reports endpoint with authentication
    - Update `src/app/api/reports/route.ts` POST to call `requireSessionUser()` and derive `reporterId` from session
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 3. Checkpoint — Session and identity refactoring
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Password validation and admin-reset removal
  - [x] 4.1 Harden password validation in `src/lib/validations/auth.ts`
    - Add zod rules: min 8, max 128, uppercase, lowercase, digit, special character
    - Apply to both registration and password reset schemas
    - Return 400 with specific unmet criteria on failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Remove the admin-reset endpoint
    - Delete `src/app/api/auth/admin-reset/route.ts` and its directory
    - Verify requests to `/api/auth/admin-reset` return 404
    - _Requirements: 4.1, 4.2_
  - [x]* 4.3 Write unit tests for password validation
    - Test passwords missing each required character class are rejected
    - Test boundary lengths (7, 8, 128, 129 characters)
    - _Requirements: 3.1, 3.2, 3.4_

- [x] 5. CSRF protection and security headers
  - [x] 5.1 Add CSRF validation in `middleware.ts`
    - Validate `Origin` or `Referer` header on POST/PUT/DELETE requests against `NEXT_PUBLIC_APP_URL`
    - Return 403 on mismatch; allow when both headers are absent
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 5.2 Add security headers in `next.config.ts`
    - Configure `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` (production), `Referrer-Policy`, and `Content-Security-Policy`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x]* 5.3 Write unit tests for CSRF middleware
    - Test POST with mismatched Origin returns 403
    - Test POST with valid Origin passes through
    - Test GET requests are not checked
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 6. Suspended user access control
  - [x] 6.1 Implement suspended user guard in `requireActiveUser()`
    - Return 403 with suspension message when `isSuspended` is true on write operations
    - Allow read operations for suspended users
    - _Requirements: 28.1, 28.2, 28.4_
  - [x] 6.2 Add suspended user banner on login
    - When a suspended user logs in, include suspension status and reason in the session response
    - Update client to display a banner when suspended
    - _Requirements: 28.3_

- [x] 7. Checkpoint — Security hardening complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Persistent rate limiting
  - [x] 8.1 Create `src/lib/db/models/RateLimit.ts` Mongoose model
    - Fields: `key` (unique composite "ip:route"), `count`, `expiresAt` (TTL index)
    - _Requirements: 10.1, 10.2_
  - [x] 8.2 Refactor `src/lib/api/rate-limit.ts` to use MongoDB storage
    - Implement `checkRateLimit(ip, route)` with atomic `findOneAndUpdate` upsert
    - Configure stricter limits for auth endpoints (login: 10/min, register: 5/min, reset: 3/min)
    - Return 429 with `Retry-After` header when exceeded
    - Fall back to in-memory Map if MongoDB is unreachable, log warning
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3_
  - [x] 8.3 Integrate rate limiter into `middleware.ts`
    - Apply rate limiting before route handlers
    - _Requirements: 9.1, 9.4_
  - [x]* 8.4 Write property tests for rate limiter
    - **Property 2: After maxRequests calls within windowMs, all subsequent calls return allowed=false**
    - **Validates: Requirements 9.1, 9.2, 9.3**
  - [x]* 8.5 Write unit tests for rate limiter fallback
    - Test fallback to in-memory when MongoDB is unavailable
    - Test TTL-based expiry resets counters
    - _Requirements: 10.3_

- [x] 9. Database connection pooling, health checks, and index optimization
  - [x] 9.1 Configure MongoDB connection pooling in `src/lib/db/connection.ts`
    - Set `maxPoolSize: 10`, `connectTimeoutMS: 5000`
    - Add retry logic (3 attempts, exponential backoff) on connection failure
    - _Requirements: 11.1, 11.2_
  - [x] 9.2 Create health endpoint at `src/app/api/health/route.ts`
    - Return MongoDB connection status, Supabase reachability, app version
    - Return 503 if MongoDB is unhealthy
    - _Requirements: 11.3, 11.4_
  - [x] 9.3 Add database indexes
    - Listing model: compound `{status, propertyType, monthlyRent}`, 2dsphere on `location`, compound `{posterId, status}`
    - Payment model: compound `{seekerId, status}`, `{posterId, status}`
    - Notification model: compound `{userId, isRead, isDismissed, createdAt}`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 9.4 Optimize admin seed to run once
    - Add a module-level flag to prevent re-running seed on every `dbConnect()`
    - Log error and skip retry on seed failure
    - _Requirements: 13.1, 13.2, 13.3_

- [x] 10. Search query timeout and pagination
  - [x] 10.1 Add query timeout to search service
    - Set `maxTimeMS(5000)` on all search queries
    - Catch `MongoServerError` with code 50 (exceeded time limit) and return `{ results: [], timeout: true }`
    - _Requirements: 14.1, 14.2_
  - [x] 10.2 Implement cursor-based pagination for deep pages
    - Limit max page size to 100
    - Use cursor-based pagination (last document `_id`) for pages beyond 10
    - _Requirements: 14.3, 14.4_
  - [x]* 10.3 Write unit tests for search timeout and pagination
    - Test page size capping at 100
    - Test cursor-based pagination returns correct results
    - _Requirements: 14.2, 14.3, 14.4_

- [x] 11. Checkpoint — Infrastructure and performance
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Email service and delivery infrastructure
  - [x] 12.1 Create `src/lib/db/models/EmailLog.ts` Mongoose model
    - Fields: `recipient`, `template`, `status`, `attempts`, `lastAttemptAt`, `error`, `createdAt`
    - Index: `{ recipient: 1, createdAt: -1 }`
    - _Requirements: 20.1_
  - [x] 12.2 Create `src/lib/services/email.ts` email service
    - Implement `sendEmail(options)` using Resend with HTML templates for verification, password_reset, payment_confirmation, report_resolution
    - Support locale-based template selection using next-intl messages
    - Include unsubscribe link in non-essential emails
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_
  - [x] 12.3 Implement retry logic and delivery logging
    - Retry up to 3 times with exponential backoff (1s, 4s, 16s)
    - Skip retry on hard bounces (invalid address)
    - Log every attempt to EmailLog model
    - On final failure, create in-app notification as fallback
    - _Requirements: 20.1, 20.2, 20.3, 20.4_
  - [x]* 12.4 Write unit tests for email service
    - Test retry behavior on transient failures
    - Test hard bounce skips retry
    - Test fallback notification on final failure
    - _Requirements: 20.2, 20.3, 20.4_

- [x] 13. Favorites feature
  - [x] 13.1 Create `src/lib/db/models/Favorite.ts` Mongoose model
    - Fields: `userId`, `listingId`, `savedAt`
    - Indexes: `{ userId: 1, savedAt: -1 }`, `{ userId: 1, listingId: 1 }` unique
    - _Requirements: 15.1_
  - [x] 13.2 Create `src/lib/services/favorites.ts` service
    - Implement `addFavorite`, `removeFavorite`, `getFavorites`, `isFavorited`
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  - [x] 13.3 Create API routes for favorites
    - `POST /api/favorites` — add favorite (requires auth)
    - `DELETE /api/favorites/[listingId]` — remove favorite (requires auth)
    - `GET /api/favorites` — list user favorites sorted by savedAt desc
    - All routes use `requireActiveUser()` for identity
    - _Requirements: 15.1, 15.2, 15.3_
  - [x] 13.4 Add `isFavorited` flag to listing detail response
    - When an authenticated user fetches a listing, include whether it's in their favorites
    - _Requirements: 15.4_
  - [x]* 13.5 Write unit tests for favorites service
    - Test add/remove/list operations
    - Test duplicate favorite is idempotent
    - _Requirements: 15.1, 15.2, 15.3_

- [x] 14. Messaging system
  - [x] 14.1 Create `src/lib/db/models/MessageThread.ts` and `src/lib/db/models/Message.ts` Mongoose models
    - MessageThread: `listingId`, `participants`, `lastMessageAt`, `createdAt`; indexes: `{ participants: 1 }`, `{ listingId: 1, participants: 1 }`
    - Message: `threadId`, `senderId`, `body`, `createdAt`; index: `{ threadId: 1, createdAt: 1 }`
    - _Requirements: 16.1, 16.5_
  - [x] 14.2 Create `src/lib/services/messages.ts` service
    - Implement `sendMessage`, `getThreads`, `getMessages`
    - Create thread on first message for a listing+seeker pair
    - Prevent messages from suspended users
    - _Requirements: 16.1, 16.4, 16.5_
  - [x] 14.3 Create API routes for messaging
    - `POST /api/messages` — send message (requires active user)
    - `GET /api/messages/threads` — list user's threads
    - `GET /api/messages/threads/[threadId]` — get messages in thread
    - All routes derive identity from session
    - _Requirements: 16.1, 16.4, 16.5_
  - [x] 14.4 Trigger notifications on new messages
    - Create in-app notification for recipient on each new message
    - Send email notification if recipient has email notifications enabled
    - _Requirements: 16.2, 16.3_
  - [x]* 14.5 Write unit tests for messaging service
    - Test thread creation on first message
    - Test suspended user cannot send messages
    - Test message retrieval only for participants
    - _Requirements: 16.1, 16.4, 16.5_

- [x] 15. Checkpoint — New features (favorites, messaging)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. User profile page and listing expiration
  - [x] 16.1 Add `bio` field to User model and `expiresAt`/`renewedAt` fields to Listing model
    - `User`: add optional `bio: string`
    - `Listing`: add `expiresAt: Date` (default: createdAt + 90 days), optional `renewedAt: Date`
    - _Requirements: 17.4, 18.1_
  - [x] 16.2 Create user profile API route `src/app/api/users/[id]/profile/route.ts`
    - Return trust score, badge, completed transactions, 3 most recent reviews, active listings, member-since date, profile completeness, suspended flag
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  - [x] 16.3 Create user profile page `src/app/users/[id]/page.tsx`
    - Display all profile data from the API
    - Show "flagged" indicator for suspended users
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  - [x] 16.4 Implement listing expiration logic
    - Add `expiresAt` filter to search queries: exclude listings where `expiresAt < now`
    - Create `src/app/api/listings/expire/route.ts` for cron-triggered archival of expired listings
    - _Requirements: 18.1, 18.4_
  - [x] 16.5 Implement listing renewal and expiry notifications
    - Create `POST /api/listings/[id]/renew` route to reset `expiresAt` to now + 90 days
    - Send notification 7 days before expiry (query listings where `expiresAt` is within 7 days)
    - _Requirements: 18.2, 18.3_
  - [x]* 16.6 Write unit tests for listing expiration
    - Test expired listings excluded from search
    - Test renewal resets expiration timer
    - _Requirements: 18.1, 18.3, 18.4_

- [x] 17. Admin scam review dashboard and verification tools
  - [x] 17.1 Create scam review API route `src/app/api/admin/scam-review/route.ts`
    - GET: return listings with `scamRiskLevel` "medium" or "high", including scam flags, poster trust score, confirmed scam count
    - Require admin auth via `requireAdmin()`
    - _Requirements: 21.1, 21.2, 21.5_
  - [x] 17.2 Create approve/reject routes for scam review
    - `POST /api/admin/scam-review/[id]/approve` — set status "active", risk "low"
    - `POST /api/admin/scam-review/[id]/reject` — set status "archived", notify poster with reason
    - _Requirements: 21.3, 21.4_
  - [x] 17.3 Create scam review dashboard page `src/app/admin/scam-review/page.tsx`
    - Display flagged listings with scam flags, poster info, trust score
    - Include reverse image search links for each photo, map pin for address
    - Show creation date, last edit date, poster account age
    - Highlight duplicate-address listings from different posters
    - _Requirements: 21.1, 21.2, 21.5, 22.1, 22.2, 22.3, 22.4_
  - [x]* 17.4 Write unit tests for scam review API
    - Test approve sets correct status and risk level
    - Test reject archives and creates notification
    - _Requirements: 21.3, 21.4_

- [x] 18. Checkpoint — Features and admin tooling
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Replace emoji icons with SVG icons and placeholder images
  - [x] 19.1 Create SVG icon components in `src/components/icons/`
    - Application logo (navbar, auth layout, favicon variants)
    - Feature card icons (scam protection, dual-party payments, trust scores)
    - Notification type icons
    - Theme toggle and navigation icons
    - _Requirements: 23.2, 23.3, 23.4, 23.5_
  - [x] 19.2 Replace emoji usage across components
    - Update homepage feature cards to use SVG icon components
    - Update notification components to use SVG type indicators
    - Update navbar/auth layout to use SVG logo and icons
    - _Requirements: 23.2, 23.3, 23.4, 23.5_
  - [x] 19.3 Add placeholder images for listings without photos
    - Use `https://placehold.co/` URLs with appropriate dimensions and text
    - _Requirements: 23.1_

- [x] 20. Image asset checklist
  - [x] 20.1 Update `SETUP_CHECKLIST.md` with image asset inventory
    - List all required logos, icons, placeholder images with dimensions and usage locations
    - Include: app logo, hero background, listing placeholder, feature card icons, notification icons, trust badge icons, property type icons, user avatar placeholder
    - Specify recommended format (SVG for icons, WebP for photos)
    - _Requirements: 24.1, 24.2, 24.3_

- [x] 21. Mobile responsiveness and accessibility
  - [x] 21.1 Implement collapsible filter drawer for mobile
    - Convert search filter sidebar to a collapsible drawer on screens < 1024px
    - _Requirements: 25.1_
  - [x] 21.2 Fix touch targets and form accessibility
    - Ensure all interactive elements have min 44x44px touch targets on mobile
    - Add associated `<label>` elements to all form inputs
    - Add descriptive `alt` text to all images
    - _Requirements: 25.2, 25.3, 25.4_
  - [x] 21.3 Audit and fix color contrast
    - Review all text/background combinations for WCAG 2.1 AA compliance (4.5:1 minimum)
    - Update Tailwind theme colors where needed
    - _Requirements: 25.5_

- [x] 22. Footer, error pages, and final UI components
  - [x] 22.1 Create footer component `src/components/Footer.tsx`
    - Links to privacy policy, terms of service, contact page
    - Copyright notice with current year and app name
    - Language and currency selectors
    - _Requirements: 26.1, 26.2, 26.3_
  - [x] 22.2 Add footer to root layout
    - Include footer on all pages via the root layout
    - _Requirements: 26.1_
  - [x] 22.3 Create custom error pages
    - `src/app/not-found.tsx` — 404 page with links to homepage and search
    - `src/app/error.tsx` — 500 page with retry message and homepage link
    - Use placeholder images consistent with design system
    - _Requirements: 27.1, 27.2, 27.3_

- [x] 23. Final checkpoint — UI/UX and full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major domain
- Property tests validate universal correctness properties from the design
- The implementation language is TypeScript throughout (Next.js 15 + React 19)
