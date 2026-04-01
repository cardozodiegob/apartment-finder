# Requirements Document

## Introduction

Full security, infrastructure, and UX audit of the Apartment Finder webapp — a Next.js rental listing platform targeting European expats. The audit addresses eight focus areas: authentication and security hardening, session management fixes, database health, performance optimization, missing features, email infrastructure, listing moderation tooling, and UI/UX improvements. The webapp currently suffers from broken session handling that prevents authenticated actions, admin routes that accept user-supplied IDs instead of deriving them from the session, and several missing features expected of a rental platform.

## Glossary

- **Auth_System**: The authentication subsystem comprising Supabase Auth, httpOnly cookie-based session tokens, and the MongoDB User model
- **Session_Manager**: The server-side component responsible for issuing, validating, refreshing, and revoking access and refresh tokens stored in httpOnly cookies
- **Admin_Guard**: The middleware that verifies a requesting user holds the "admin" role before allowing access to admin API routes
- **Scam_Detector**: The service that analyzes listings for duplicate photos, pricing anomalies, and suspicious description keywords
- **Rate_Limiter**: The in-memory rate limiting middleware that throttles API requests per IP address
- **Notification_Service**: The service that creates in-app notifications and triggers email delivery for critical events
- **Email_Service**: The transactional email subsystem using Resend for sending verification, password reset, payment, and report notification emails
- **Search_Engine**: The MongoDB-backed search service supporting full-text, geo-boundary, and filter-based listing queries
- **Payment_Processor**: The Stripe-based escrow payment system with dual-party confirmation
- **Privacy_Manager**: The GDPR compliance service handling consent, data export, and data deletion
- **Listing_Service**: The service managing CRUD operations, photo uploads, and publishing workflows for rental listings
- **Trust_Engine**: The service computing time-decayed trust scores and user badges from reviews

---

## Requirements

### Requirement 1: Fix Session Token Refresh

**User Story:** As a user, I want my session to persist across page reloads and not expire after one hour, so that I can use the webapp without being unexpectedly logged out.

#### Acceptance Criteria

1. WHEN the access token expires, THE Session_Manager SHALL use the stored refresh token to obtain a new access token from Supabase and update both cookies
2. WHEN the refresh token is valid, THE Session_Manager SHALL set the new access token cookie with a maxAge of 3600 seconds and the new refresh token cookie with a maxAge of 604800 seconds
3. IF the refresh token is expired or invalid, THEN THE Session_Manager SHALL delete both cookies and return a 401 response
4. THE Session_Manager SHALL attempt token refresh before returning an unauthorized response on any authenticated API route
5. WHEN a token refresh succeeds, THE Session_Manager SHALL complete the original API request without requiring the client to retry

---

### Requirement 2: Derive User Identity from Session Cookies

**User Story:** As a developer, I want all API routes to derive the authenticated user from session cookies rather than from client-supplied query parameters or request bodies, so that users cannot impersonate other users.

#### Acceptance Criteria

1. THE Admin_Guard SHALL extract the user identity from the httpOnly session cookie and verify the user role from the MongoDB User record
2. THE Admin_Guard SHALL reject requests where the session cookie is missing or the token is invalid with a 401 status code
3. WHEN an admin API route receives a request, THE Admin_Guard SHALL ignore any "adminId" query parameter or body field and use only the session-derived identity
4. THE Listing_Service SHALL derive the poster identity from the session cookie for all create, update, delete, and publish operations
5. THE Notification_Service SHALL derive the user identity from the session cookie for all notification read, dismiss, and preference operations
6. THE Payment_Processor SHALL derive the user identity from the session cookie for all confirm, cancel, and dispute operations

---

### Requirement 3: Secure Password Handling

**User Story:** As a user, I want my password to be validated with strong rules at registration, so that my account is protected against brute-force and dictionary attacks.

#### Acceptance Criteria

1. THE Auth_System SHALL require passwords to contain at least one uppercase letter, one lowercase letter, one digit, and one special character
2. THE Auth_System SHALL reject passwords shorter than 8 characters or longer than 128 characters with a descriptive validation error
3. THE Auth_System SHALL enforce the same password complexity rules for password reset operations
4. WHEN a user submits a password that does not meet complexity requirements, THE Auth_System SHALL return a 400 response with a specific error message listing the unmet criteria

---

### Requirement 4: Remove Admin Reset Endpoint

**User Story:** As a security engineer, I want the temporary admin-reset endpoint removed, so that the service role key cannot be used to reset arbitrary user passwords via a public API.

#### Acceptance Criteria

1. THE Auth_System SHALL NOT expose the `/api/auth/admin-reset` route in any environment
2. WHEN a request is made to `/api/auth/admin-reset`, THE Auth_System SHALL return a 404 response

---

### Requirement 5: Add CSRF Protection

**User Story:** As a user, I want state-changing API requests to be protected against cross-site request forgery, so that malicious sites cannot perform actions on my behalf.

#### Acceptance Criteria

1. THE Auth_System SHALL validate the `Origin` or `Referer` header on all POST, PUT, and DELETE API requests against the configured application domain
2. IF the `Origin` header does not match the application domain, THEN THE Auth_System SHALL reject the request with a 403 status code
3. THE Auth_System SHALL allow requests without an `Origin` header only when the `Referer` header matches the application domain or both headers are absent (same-origin non-browser clients)

---

### Requirement 6: Add Security Headers

**User Story:** As a security engineer, I want the webapp to send standard security headers on all responses, so that common web vulnerabilities are mitigated.

#### Acceptance Criteria

1. THE Auth_System SHALL set the `X-Content-Type-Options` header to `nosniff` on all responses
2. THE Auth_System SHALL set the `X-Frame-Options` header to `DENY` on all responses
3. THE Auth_System SHALL set the `Strict-Transport-Security` header to `max-age=31536000; includeSubDomains` on all responses in production
4. THE Auth_System SHALL set the `Referrer-Policy` header to `strict-origin-when-cross-origin` on all responses
5. THE Auth_System SHALL set a `Content-Security-Policy` header that restricts script sources to `self` and required CDN origins

---

### Requirement 7: Protect Reports Endpoint with Authentication

**User Story:** As a platform operator, I want the reports creation endpoint to require authentication, so that anonymous users cannot spam the report queue.

#### Acceptance Criteria

1. WHEN an unauthenticated user sends a POST request to `/api/reports`, THE Auth_System SHALL return a 401 response
2. THE Listing_Service SHALL derive the reporter identity from the session cookie and set it as the `reporterId` field
3. WHEN an authenticated user creates a report, THE Listing_Service SHALL use the session-derived user ID as the reporter, ignoring any `reporterId` in the request body

---

### Requirement 8: Protect Notifications Endpoint with Authentication

**User Story:** As a user, I want my notifications to be accessible only to me, so that other users cannot read or manipulate my notifications.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/notifications`, THE Notification_Service SHALL derive the user identity from the session cookie
2. THE Notification_Service SHALL ignore any `userId` query parameter and use only the session-derived identity
3. IF the session cookie is missing or invalid, THEN THE Notification_Service SHALL return a 401 response

---

### Requirement 9: Enforce Rate Limiting on Auth Endpoints

**User Story:** As a platform operator, I want authentication endpoints to have stricter rate limits, so that brute-force login and registration attacks are mitigated.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL limit login attempts to 10 requests per minute per IP address
2. THE Rate_Limiter SHALL limit registration attempts to 5 requests per minute per IP address
3. THE Rate_Limiter SHALL limit password reset requests to 3 requests per minute per IP address
4. WHEN the rate limit is exceeded, THE Rate_Limiter SHALL return a 429 response with a `Retry-After` header indicating the number of seconds until the limit resets

---

### Requirement 10: Persistent Rate Limiting

**User Story:** As a platform operator, I want rate limiting state to survive server restarts, so that attackers cannot bypass limits by triggering redeployments.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL store rate limit counters in a shared data store (MongoDB or Redis) rather than in-memory
2. THE Rate_Limiter SHALL expire rate limit entries automatically after the configured window duration
3. WHEN the data store is unavailable, THE Rate_Limiter SHALL fall back to in-memory rate limiting and log a warning

---


### Requirement 11: Database Connection Pooling and Health Checks

**User Story:** As a platform operator, I want the database connection to be monitored and resilient, so that transient MongoDB failures do not crash the application.

#### Acceptance Criteria

1. THE Listing_Service SHALL configure MongoDB connection pooling with a maximum of 10 connections and a connection timeout of 5000 milliseconds
2. WHEN a MongoDB connection fails, THE Listing_Service SHALL retry the connection up to 3 times with exponential backoff before returning an error
3. THE Listing_Service SHALL expose a `/api/health` endpoint that returns the MongoDB connection status, Supabase reachability, and application version
4. IF the MongoDB connection is unhealthy, THEN THE Listing_Service SHALL return a 503 status from the health endpoint

---

### Requirement 12: Database Index Optimization

**User Story:** As a platform operator, I want database queries to use appropriate indexes, so that search and listing retrieval remain performant as data grows.

#### Acceptance Criteria

1. THE Search_Engine SHALL use a compound index on `{status, propertyType, monthlyRent}` for filtered listing queries
2. THE Search_Engine SHALL use a 2dsphere index on the `location` field for geographic boundary queries
3. THE Listing_Service SHALL use a compound index on `{posterId, status}` for user listing queries
4. THE Payment_Processor SHALL use a compound index on `{seekerId, status}` and `{posterId, status}` for payment queries
5. THE Notification_Service SHALL use a compound index on `{userId, isRead, isDismissed, createdAt}` for notification queries

---

### Requirement 13: Prevent Admin Seed on Every Request

**User Story:** As a developer, I want the admin seeding logic to run only once at application startup, so that database connections are not wasted on redundant seed checks.

#### Acceptance Criteria

1. THE Auth_System SHALL execute the admin seed function at most once per application lifecycle
2. THE Auth_System SHALL not call the admin seed function on every `dbConnect()` invocation after the first successful seed
3. IF the admin seed fails, THEN THE Auth_System SHALL log the error and not retry on subsequent requests

---

### Requirement 14: Search Query Timeout and Pagination Optimization

**User Story:** As a user, I want search results to load within 2 seconds even with complex filters, so that the search experience is responsive.

#### Acceptance Criteria

1. THE Search_Engine SHALL enforce a query timeout of 5000 milliseconds on all MongoDB search queries
2. WHEN a search query times out, THE Search_Engine SHALL return an empty result set with a `timeout: true` flag
3. THE Search_Engine SHALL limit the maximum page size to 100 results per request
4. THE Search_Engine SHALL use cursor-based pagination for queries beyond page 10 to avoid deep skip performance degradation

---

### Requirement 15: Add Saved Listings / Favorites Feature

**User Story:** As a seeker, I want to save listings to a favorites list, so that I can compare and revisit them later.

#### Acceptance Criteria

1. WHEN an authenticated user saves a listing, THE Listing_Service SHALL store the listing reference in the user's favorites collection
2. WHEN an authenticated user removes a saved listing, THE Listing_Service SHALL remove the listing reference from the user's favorites collection
3. THE Listing_Service SHALL return the user's saved listings sorted by the date they were saved, most recent first
4. THE Listing_Service SHALL indicate whether a listing is saved by the current user when returning listing details

---

### Requirement 16: Add Messaging System Between Seekers and Posters

**User Story:** As a seeker, I want to message a listing poster directly through the platform, so that I can ask questions without sharing personal contact information.

#### Acceptance Criteria

1. WHEN an authenticated seeker sends a message about a listing, THE Notification_Service SHALL create a message thread linked to the listing
2. THE Notification_Service SHALL deliver an in-app notification to the recipient for each new message
3. WHEN a critical message is received, THE Email_Service SHALL send an email notification to the recipient if email notifications are enabled
4. THE Notification_Service SHALL prevent messages from suspended users
5. THE Notification_Service SHALL store message history and allow both parties to view the conversation thread

---

### Requirement 17: Add User Profile Page

**User Story:** As a user, I want a public profile page showing my trust score, reviews, and active listings, so that other users can evaluate my trustworthiness.

#### Acceptance Criteria

1. THE Trust_Engine SHALL display the user's trust score, badge, and number of completed transactions on the profile page
2. THE Trust_Engine SHALL display the three most recent reviews for the user on the profile page
3. THE Listing_Service SHALL display the user's active listings on the profile page
4. THE Trust_Engine SHALL display the user's member-since date and profile completeness percentage
5. IF the user is suspended, THEN THE Trust_Engine SHALL display a "flagged" indicator on the profile page

---

### Requirement 18: Add Listing Expiration and Renewal

**User Story:** As a platform operator, I want listings to expire after 90 days, so that stale listings are automatically removed from search results.

#### Acceptance Criteria

1. THE Listing_Service SHALL mark active listings as "archived" when they are older than 90 days from their creation date
2. WHEN a listing is about to expire (7 days before), THE Notification_Service SHALL send a notification to the poster
3. WHEN a poster renews a listing, THE Listing_Service SHALL reset the expiration timer to 90 days from the renewal date
4. THE Search_Engine SHALL exclude expired listings from search results

---

### Requirement 19: Implement Transactional Email Templates

**User Story:** As a user, I want to receive well-structured, branded emails for all platform communications, so that I can easily understand and act on them.

#### Acceptance Criteria

1. THE Email_Service SHALL send a verification email with a branded HTML template when a user registers
2. THE Email_Service SHALL send a password reset email with a branded HTML template containing a secure reset link
3. THE Email_Service SHALL send a payment confirmation email with transaction details when a payment is completed
4. THE Email_Service SHALL send a report resolution email when a report the user filed is resolved
5. THE Email_Service SHALL include an unsubscribe link in all non-essential emails that updates the user's notification preferences
6. THE Email_Service SHALL use the user's preferred language for all email content

---

### Requirement 20: Email Delivery Logging and Retry

**User Story:** As a platform operator, I want email delivery to be logged and retried on failure, so that critical communications are not silently lost.

#### Acceptance Criteria

1. THE Email_Service SHALL log every email send attempt with the recipient, template type, and delivery status
2. IF an email send fails, THEN THE Email_Service SHALL retry up to 3 times with exponential backoff
3. IF all retries fail, THEN THE Email_Service SHALL log a critical error and create an in-app notification as a fallback
4. THE Email_Service SHALL not retry emails that fail due to invalid recipient addresses (hard bounces)

---

### Requirement 21: Admin Scam Review Dashboard

**User Story:** As an admin, I want a dedicated scam review dashboard showing flagged listings with risk details, so that I can efficiently review and act on potential scams.

#### Acceptance Criteria

1. THE Scam_Detector SHALL display all listings with `scamRiskLevel` of "medium" or "high" in the admin scam review queue
2. THE Scam_Detector SHALL display the specific scam flags (duplicate photos, pricing anomaly, suspicious description) for each flagged listing
3. WHEN an admin approves a flagged listing, THE Scam_Detector SHALL set the listing status to "active" and the scam risk level to "low"
4. WHEN an admin rejects a flagged listing, THE Scam_Detector SHALL set the listing status to "archived" and notify the poster with the rejection reason
5. THE Scam_Detector SHALL display the poster's trust score and confirmed scam report count alongside each flagged listing

---

### Requirement 22: Listing Verification Tools

**User Story:** As an admin, I want tools to verify listing authenticity (reverse image search link, address validation), so that I can make informed moderation decisions.

#### Acceptance Criteria

1. THE Scam_Detector SHALL provide a link to reverse image search for each listing photo in the admin review interface
2. THE Scam_Detector SHALL display a map pin for the listing address in the admin review interface
3. THE Scam_Detector SHALL display the listing creation date, last edit date, and poster account age in the admin review interface
4. THE Scam_Detector SHALL highlight listings where the same address appears in multiple active listings from different posters

---

### Requirement 23: Replace Emoji Icons with Proper SVG Icons and Placeholder Images

**User Story:** As a user, I want the webapp to use professional SVG icons and proper placeholder images instead of emoji characters, so that the interface looks polished and consistent across platforms.

#### Acceptance Criteria

1. THE Listing_Service SHALL use placeholder images from `https://placehold.co/` with appropriate dimensions and text for listings without photos
2. THE Auth_System SHALL use SVG icons for the application logo in the navbar, auth layout, and favicon
3. THE Listing_Service SHALL use SVG icons for feature cards (scam protection, dual-party payments, trust scores) on the homepage instead of emoji characters
4. THE Notification_Service SHALL use SVG icons for notification type indicators instead of emoji characters
5. THE Auth_System SHALL use SVG icons for theme toggle and navigation elements instead of emoji characters

---

### Requirement 24: Create Image Asset Checklist

**User Story:** As a developer, I want a documented list of all required image assets, so that a designer can produce them and the team can track which placeholders remain.

#### Acceptance Criteria

1. THE Listing_Service SHALL maintain an image asset checklist in `SETUP_CHECKLIST.md` listing all required logos, icons, and placeholder images with their dimensions and usage locations
2. THE Listing_Service SHALL include entries for: application logo (navbar, auth, favicon), hero background image, listing placeholder image, feature card icons, notification type icons, trust badge icons, property type icons, and user avatar placeholder
3. THE Listing_Service SHALL specify the recommended dimensions and format (SVG preferred for icons, WebP for photos) for each asset

---

### Requirement 25: Improve Mobile Responsiveness and Accessibility

**User Story:** As a mobile user, I want the webapp to be fully usable on small screens with proper touch targets and screen reader support, so that I can search and manage listings from my phone.

#### Acceptance Criteria

1. THE Search_Engine SHALL display the filter sidebar as a collapsible drawer on screens narrower than 1024 pixels
2. THE Listing_Service SHALL ensure all interactive elements have a minimum touch target size of 44x44 pixels on mobile
3. THE Auth_System SHALL ensure all form inputs have associated label elements for screen reader compatibility
4. THE Listing_Service SHALL ensure all images have descriptive `alt` text
5. THE Listing_Service SHALL ensure color contrast ratios meet WCAG 2.1 AA standards (minimum 4.5:1 for normal text)

---

### Requirement 26: Add Footer with Legal Links and Site Information

**User Story:** As a user, I want a consistent footer across all pages with links to privacy policy, terms of service, and contact information, so that I can find legal and support information.

#### Acceptance Criteria

1. THE Auth_System SHALL display a footer on all pages containing links to the privacy policy, terms of service, and contact page
2. THE Auth_System SHALL display the current year and application name in the footer copyright notice
3. THE Auth_System SHALL include language and currency selectors in the footer as an alternative to the navbar selectors

---

### Requirement 27: Implement Proper Error Pages

**User Story:** As a user, I want to see helpful error pages (404, 500) with navigation options, so that I can recover from errors without manually editing the URL.

#### Acceptance Criteria

1. WHEN a user navigates to a non-existent page, THE Auth_System SHALL display a custom 404 page with a link to the homepage and search page
2. WHEN an unexpected server error occurs, THE Auth_System SHALL display a custom 500 page with a message to try again later and a link to the homepage
3. THE Auth_System SHALL use placeholder images on error pages consistent with the application design system

---

### Requirement 28: Add Suspended User Access Control

**User Story:** As a platform operator, I want suspended users to be blocked from creating listings, sending messages, and making payments, so that bad actors cannot continue operating on the platform.

#### Acceptance Criteria

1. WHEN a suspended user attempts to create a listing, THE Listing_Service SHALL return a 403 response with a message indicating the account is suspended
2. WHEN a suspended user attempts to initiate a payment, THE Payment_Processor SHALL return a 403 response with a message indicating the account is suspended
3. WHEN a suspended user logs in, THE Auth_System SHALL allow the login but display a banner indicating the account is suspended and the reason
4. THE Admin_Guard SHALL allow suspended users to view their own data but prevent write operations
