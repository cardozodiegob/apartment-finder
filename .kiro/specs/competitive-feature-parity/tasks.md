# Implementation Plan: Competitive Feature Parity

## Overview

Incremental implementation of 8 competitive parity features for the ApartmentFinder platform. Tasks are ordered so that foundational data models and services are built first, then API routes, then UI pages, and finally cross-cutting concerns (SEO, i18n). Each feature group wires together before moving to the next.

## Tasks

- [x] 1. Messages Dashboard Page
  - [x] 1.1 Extend MessageThread model with `readBy` field and update messages service
    - Add `readBy: Map<string, Date>` to `IMessageThread` interface and `MessageThreadSchema` in `src/lib/db/models/MessageThread.ts`
    - Update `getMessages()` in `src/lib/services/messages.ts` to set `readBy[userId]` to current timestamp when messages are fetched
    - Update `getThreads()` to include `readBy` data so the client can determine unread status
    - _Requirements: 1.7_

  - [ ]* 1.2 Write unit tests for readBy tracking logic
    - Test that `getMessages()` updates `readBy` for the calling user
    - Test that `getThreads()` returns correct unread status based on `readBy` vs `lastMessageAt`
    - _Requirements: 1.7_

  - [x] 1.3 Create Messages Dashboard page with ThreadList, MessageView, and EmptyState components
    - Create `src/app/dashboard/messages/page.tsx` as a client component
    - Implement `ThreadList` component showing threads sorted by `lastMessageAt` desc with listing title, participant name, and unread badge
    - Implement `MessageView` component displaying messages chronologically with a send form at the bottom
    - Implement `EmptyState` component with guidance on starting conversations from listing pages
    - Use existing API endpoints: `GET /api/messages/threads`, `GET /api/messages/threads/[threadId]`, `POST /api/messages`
    - Redirect unauthenticated users to `/login`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Checkpoint - Messages Dashboard
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Viewing Scheduler
  - [x] 3.1 Create Viewing Mongoose model
    - Create `src/lib/db/models/Viewing.ts` with `IViewing` interface: `listingId`, `seekerId`, `posterId`, `proposedDate`, `status` (pending/confirmed/declined/completed), `declineReason`
    - Add indexes: `{ listingId: 1, seekerId: 1, status: 1 }`, `{ posterId: 1, status: 1 }`, `{ status: 1, proposedDate: 1 }`
    - Export model and register in `src/lib/db/models/index.ts`
    - _Requirements: 2.3, 2.8_

  - [x] 3.2 Implement viewings service
    - Create `src/lib/services/viewings.ts` with functions:
      - `requestViewing(seekerId, listingId, proposedDate)` — validate date is future, check no duplicate pending request, create Viewing doc, notify poster
      - `confirmViewing(viewingId, posterId)` — validate poster owns listing, update status to "confirmed", notify seeker
      - `declineViewing(viewingId, posterId, reason?)` — update status to "declined", notify seeker
      - `getViewingsForUser(userId)` — return viewings where user is seeker or poster
      - `completeExpiredViewings()` — mark confirmed viewings with past dates as "completed"
    - Use existing `notifications.ts` service for notifications
    - _Requirements: 2.3, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 3.3 Write property test for viewing request validation
    - **Property 1: Viewing date must always be in the future at creation time**
    - **Validates: Requirements 2.7**

  - [ ]* 3.4 Write unit tests for viewings service
    - Test duplicate pending request prevention
    - Test poster ownership validation on confirm/decline
    - Test expired viewing completion logic
    - _Requirements: 2.7, 2.8, 2.9_

  - [x] 3.5 Create viewing API routes
    - Create `src/app/api/viewings/route.ts` — POST (create viewing request), GET (list viewings for authenticated user)
    - Create `src/app/api/viewings/[id]/confirm/route.ts` — PATCH (poster confirms)
    - Create `src/app/api/viewings/[id]/decline/route.ts` — PATCH (poster declines)
    - All routes use `requireSessionUser` for auth
    - _Requirements: 2.1, 2.3, 2.5, 2.6_

  - [x] 3.6 Create Viewings Dashboard page and integrate with listing detail
    - Create `src/app/dashboard/viewings/page.tsx` showing pending/confirmed/declined/completed viewings for the user
    - Display seeker name, proposed date, listing title for each viewing
    - Add "Request Viewing" button with date/time picker to `src/app/listings/[id]/page.tsx` for authenticated seekers
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_

- [x] 4. Document Upload for Tenants
  - [x] 4.1 Create TenantDocument Mongoose model
    - Create `src/lib/db/models/TenantDocument.ts` with `ITenantDocument` interface: `userId`, `documentType` (proof_of_income/employment_letter/reference_letter/identity_document/bank_statement), `fileName`, `fileSize`, `mimeType`, `storagePath`
    - Add index: `{ userId: 1, documentType: 1 }`
    - Export model and register in `src/lib/db/models/index.ts`
    - _Requirements: 3.2, 3.5_

  - [x] 4.2 Implement documents service
    - Create `src/lib/services/documents.ts` with functions:
      - `uploadDocument(userId, file, documentType)` — validate file type (PDF/JPG/PNG) and size (≤10MB), upload to Supabase Storage `tenant-documents` bucket at path `{userId}/{documentId}.{ext}`, create TenantDocument metadata record
      - `listDocuments(userId)` — return all docs for user
      - `deleteDocument(documentId, userId)` — remove from Supabase Storage and delete metadata
      - `generateShareUrl(documentId, userId)` — create signed URL valid for 7 days
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.9_

  - [ ]* 4.3 Write property test for document upload validation
    - **Property 2: Only PDF, JPG, PNG files ≤10MB are accepted; all others are rejected**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 4.4 Write unit tests for documents service
    - Test file type validation rejects unsupported formats
    - Test file size validation rejects files over 10MB
    - Test signed URL generation returns URL with 7-day expiry
    - _Requirements: 3.3, 3.4, 3.9_

  - [x] 4.5 Create document API routes
    - Create `src/app/api/documents/route.ts` — POST (upload), GET (list user's docs)
    - Create `src/app/api/documents/[id]/route.ts` — DELETE (remove doc)
    - Create `src/app/api/documents/[id]/share/route.ts` — POST (generate time-limited URL)
    - All routes use `requireSessionUser` for auth
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.9_

  - [x] 4.6 Create Documents Dashboard page
    - Create `src/app/dashboard/documents/page.tsx` with "My Documents" section
    - Display uploaded documents with file name, document type, upload date, and download link
    - Implement upload form with document type selector and file input with validation feedback
    - Implement delete functionality with confirmation
    - _Requirements: 3.1, 3.2, 3.6, 3.7_

- [x] 5. Checkpoint - Viewings & Documents
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Listing Comparison Tool
  - [x] 6.1 Implement comparison state management with sessionStorage
    - Create `src/lib/hooks/useCompare.ts` custom hook managing comparison state in `sessionStorage`
    - Store array of listing IDs (max 3) under key `compare_listing_ids`
    - Expose `addToCompare`, `removeFromCompare`, `clearCompare`, `comparedIds` from the hook
    - _Requirements: 4.2, 4.3, 4.7_

  - [x] 6.2 Create CompareButton and CompareBar components
    - Create `CompareButton` component ("Add to Compare" / "Remove from Compare" toggle) for use on search results and listing detail pages
    - Create `CompareBar` floating bottom bar showing selected listings (count) with "Compare Now" action, visible when ≥1 listing selected
    - Show message when user tries to add more than 3 listings
    - Integrate `CompareButton` into search results page (`src/app/search/page.tsx`) and listing detail page (`src/app/listings/[id]/page.tsx`)
    - _Requirements: 4.1, 4.3, 4.6_

  - [x] 6.3 Create ComparisonView page
    - Create `src/app/compare/page.tsx` with side-by-side layout showing: title, monthly rent, currency, property type, floor area, rooms, address, available date, amenity tags
    - Fetch listing data from existing `GET /api/listings/[id]` for each compared listing
    - Implement diff highlighting with CSS class for fields where values differ across listings
    - Implement mobile-friendly scrollable card layout using responsive breakpoints
    - _Requirements: 4.4, 4.5, 4.8_

  - [ ]* 6.4 Write unit tests for useCompare hook
    - Test max 3 listings enforcement
    - Test sessionStorage persistence across hook re-mounts
    - Test add/remove/clear operations
    - _Requirements: 4.2, 4.3, 4.7_

- [x] 7. SEO and Sitemap
  - [x] 7.1 Create dynamic sitemap and robots.txt
    - Create `src/app/sitemap.ts` using Next.js App Router convention to generate dynamic sitemap
    - Query active listings, published blog articles, and published neighborhood guides
    - Include static pages (home, search, blog index, etc.)
    - Implement sitemap index splitting when URLs exceed 50,000
    - Create `src/app/robots.ts` allowing all crawlers and referencing sitemap URL
    - _Requirements: 5.1, 5.2, 5.3, 5.8_

  - [x] 7.2 Add generateMetadata and JSON-LD to listing detail page
    - Add `generateMetadata` export to `src/app/listings/[id]/page.tsx` with dynamic `<title>` and `<meta description>` using listing title, city, and price
    - Add JSON-LD structured data (`RentalListing` schema) as `<script type="application/ld+json">` via metadata API
    - Add Open Graph meta tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
    - Add Twitter Card meta tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [ ]* 7.3 Write unit tests for sitemap generation
    - Test that active listings appear in sitemap
    - Test sitemap index splitting logic for >50,000 URLs
    - _Requirements: 5.1, 5.8_

- [x] 8. Checkpoint - Comparison Tool & SEO
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Neighborhood Guides
  - [x] 9.1 Create NeighborhoodGuide Mongoose model
    - Create `src/lib/db/models/NeighborhoodGuide.ts` with `INeighborhoodGuide` interface: `city`, `neighborhood`, `slug` (unique), `overview` (HTML), `transitScore`, `transitInfo`, `safetyInfo`, `amenities` (supermarkets/pharmacies/schools/parks arrays), `averageRent`, `centerLat`, `centerLng`, `isPublished`, `updatedBy`
    - Add indexes: `{ slug: 1 }` (unique), `{ city: 1, neighborhood: 1 }` (unique), `{ isPublished: 1 }`
    - Export model and register in `src/lib/db/models/index.ts`
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Create neighborhood guide API routes
    - Create `src/app/api/neighborhoods/route.ts` — GET (list published guides), POST (admin create)
    - Create `src/app/api/neighborhoods/[id]/route.ts` — GET (single guide), PUT (admin edit), DELETE (admin delete)
    - Admin routes require admin role check
    - _Requirements: 7.1, 7.6_

  - [x] 9.3 Create admin CMS page for neighborhood guides
    - Create `src/app/admin/neighborhoods/page.tsx` following the existing admin content editing pattern from `src/app/admin/content/page.tsx`
    - Provide form for creating/editing guides with all fields (overview, transit, safety, amenities, average rent, coordinates, publish toggle)
    - List existing guides with edit/delete actions
    - _Requirements: 7.6_

  - [x] 9.4 Create public neighborhood guide page
    - Create `src/app/neighborhoods/[city]/[neighborhood]/page.tsx` displaying: overview, transit score + info, safety info, amenities lists, average rent, Leaflet map centered on neighborhood, active listings in the area
    - Add `generateMetadata` for SEO
    - Show "coming soon" placeholder if guide has no content or is unpublished
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.7_

  - [x] 9.5 Integrate neighborhood guide link into listing detail page
    - On `src/app/listings/[id]/page.tsx`, if `address.neighborhood` is set, display a link to the corresponding neighborhood guide
    - _Requirements: 7.3_

- [x] 10. Blog/News Section
  - [x] 10.1 Create BlogArticle Mongoose model
    - Create `src/lib/db/models/BlogArticle.ts` with `IBlogArticle` interface: `title`, `slug` (unique), `body` (HTML), `category` (moving_guides/city_guides/rental_tips/expat_life), `authorId`, `featuredImageUrl`, `isPublished`, `publishedAt`
    - Add indexes: `{ slug: 1 }` (unique), `{ isPublished: 1, publishedAt: -1 }`, `{ category: 1, isPublished: 1 }`
    - Export model and register in `src/lib/db/models/index.ts`
    - _Requirements: 8.3, 8.4_

  - [x] 10.2 Create blog API routes
    - Create `src/app/api/blog/route.ts` — GET (list published articles with pagination and category filter), POST (admin create article)
    - Create `src/app/api/blog/[slug]/route.ts` — GET (single article + related articles by same category), PUT (admin edit)
    - Admin routes require admin role check
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.8, 8.10_

  - [x] 10.3 Create admin blog management page
    - Create `src/app/admin/blog/page.tsx` with article list, create/edit form (title, slug, body, category, featured image URL, publish toggle)
    - Draft articles visible only in admin panel
    - _Requirements: 8.4, 8.5_

  - [x] 10.4 Create public blog pages
    - Create `src/app/blog/page.tsx` with paginated article list sorted by `publishedAt` desc, category filter tabs (moving_guides, city_guides, rental_tips, expat_life)
    - Create `src/app/blog/[slug]/page.tsx` with full article view (title, author, date, category, body, featured image) and related articles sidebar (same category, limit 3)
    - Add `generateMetadata` with JSON-LD (`Article` schema), Open Graph, and Twitter Card meta tags
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 8.7, 8.8, 8.10_

  - [x] 10.5 Update sitemap to include blog articles and neighborhood guides
    - Update `src/app/sitemap.ts` to query published `BlogArticle` and `NeighborhoodGuide` documents and include their URLs
    - _Requirements: 7.8, 8.9_

- [x] 11. Checkpoint - Content Features
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Multi-language UI Integration
  - [x] 12.1 Expand message JSON files with keys for all new and existing UI strings
    - Add translation keys to all 6 locale files (`messages/{en,es,fr,de,pt,it}.json`) covering:
      - Messages dashboard (thread list, message view, empty state, send button)
      - Viewings (request viewing, confirm, decline, status labels)
      - Documents (upload, document types, share, delete confirmation)
      - Comparison tool (add to compare, compare bar, comparison headers)
      - Blog (categories, read more, related articles, filter labels)
      - Neighborhood guides (section headings, coming soon placeholder)
      - Navigation labels, form labels, button text, error messages, empty states, footer content
    - _Requirements: 6.1, 6.2, 6.6, 6.8_

  - [x] 12.2 Wire `useTranslations()` and `getTranslations()` into all components
    - Replace all hardcoded English strings in new components (messages, viewings, documents, comparison, blog, neighborhoods) with `useTranslations()` calls in client components and `getTranslations()` in server components
    - Audit existing components (Navbar, Footer, search, dashboard pages, auth pages) and replace any remaining hardcoded strings
    - Use `useFormatter()` from next-intl for locale-aware date, number, and currency formatting
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.7_

- [x] 13. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The project uses TypeScript, Next.js 15 App Router, MongoDB/Mongoose, Supabase, next-intl, Vitest, and fast-check
- Existing services (messages, notifications, email, session) and models (Listing, User, MessageThread, Message) are reused wherever possible
