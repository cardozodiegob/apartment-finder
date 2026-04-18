# Requirements Document

## Introduction

This specification covers 8 competitive feature gaps identified through an audit against HousingAnywhere, Spotahome, and Uniplaces. The ApartmentFinder webapp (Next.js, MongoDB/Mongoose, Supabase auth, Stripe payments, next-intl i18n) has a solid backend foundation but lacks several frontend features and content capabilities that competitors offer. Closing these gaps will bring the platform to competitive parity for European expat apartment seekers and landlords.

## Glossary

- **App**: The ApartmentFinder Next.js web application
- **Seeker**: A user with the "seeker" role who searches for apartments
- **Poster**: A user with the "poster" role who lists properties for rent
- **Dashboard**: The authenticated user area at `/dashboard/*`
- **Messages_Page**: The frontend page at `/dashboard/messages` for viewing and sending messages
- **Thread**: A MessageThread document linking two participants to a listing conversation
- **Viewing_Scheduler**: The system for requesting, confirming, and declining property viewing appointments
- **Document_Uploader**: The system for tenants to upload and manage verification documents
- **Comparison_Tool**: The UI component for side-by-side listing comparison
- **SEO_Engine**: The system responsible for generating sitemaps, structured data, and meta tags
- **I18n_Layer**: The next-intl integration layer that provides translated strings to UI components
- **Neighborhood_Guide**: A content page displaying local information for a specific neighborhood
- **Blog_System**: The content management system for publishing articles, guides, and tips
- **Listing**: A property listing document in the database
- **Admin**: A user with the "admin" role who manages platform content and moderation

## Requirements

### Requirement 1: Messages Dashboard Page

**User Story:** As a seeker or poster, I want to view my message threads and send messages through the UI, so that I can communicate about listings without leaving the platform.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/dashboard/messages`, THE Messages_Page SHALL display a list of the user's message threads sorted by most recent activity
2. WHEN a user selects a thread from the list, THE Messages_Page SHALL display all messages in that thread in chronological order
3. WHEN a user types a message and submits the form, THE Messages_Page SHALL send the message via the existing messages API and append the new message to the conversation view
4. WHILE a thread is selected, THE Messages_Page SHALL display the listing title and the other participant's name for context
5. IF the messages API returns an error, THEN THE Messages_Page SHALL display a descriptive error message to the user
6. WHEN a user has no message threads, THE Messages_Page SHALL display an empty state with guidance on how to start a conversation from a listing page
7. THE Messages_Page SHALL indicate unread threads with a visual badge or highlight
8. WHILE the user is unauthenticated, THE Messages_Page SHALL redirect the user to the login page

### Requirement 2: Viewing Scheduler

**User Story:** As a seeker, I want to request a property viewing at a specific date and time, so that I can visit the apartment before committing to rent.

#### Acceptance Criteria

1. WHEN a seeker views an active listing detail page, THE App SHALL display a "Request Viewing" button
2. WHEN a seeker clicks "Request Viewing", THE Viewing_Scheduler SHALL present a date and time picker allowing selection of a proposed viewing slot
3. WHEN a seeker submits a viewing request, THE Viewing_Scheduler SHALL create a viewing record with status "pending" and notify the poster via the existing notification system
4. WHEN a poster views their dashboard, THE Viewing_Scheduler SHALL display a list of pending viewing requests with the seeker's name, proposed date, and listing title
5. WHEN a poster confirms a viewing request, THE Viewing_Scheduler SHALL update the viewing status to "confirmed" and notify the seeker
6. WHEN a poster declines a viewing request, THE Viewing_Scheduler SHALL update the viewing status to "declined" and notify the seeker with an optional reason
7. IF a seeker requests a viewing date in the past, THEN THE Viewing_Scheduler SHALL reject the request and display a validation error
8. THE Viewing_Scheduler SHALL prevent duplicate pending viewing requests from the same seeker for the same listing
9. WHEN a confirmed viewing date has passed, THE Viewing_Scheduler SHALL automatically update the viewing status to "completed"

### Requirement 3: Document Upload for Tenants

**User Story:** As a seeker, I want to upload proof of income, employment letters, and references, so that I can provide landlords with the documents they require for rental applications.

#### Acceptance Criteria

1. WHEN an authenticated seeker navigates to their dashboard, THE Document_Uploader SHALL provide a "My Documents" section for managing uploaded files
2. THE Document_Uploader SHALL accept uploads of the following document types: proof of income, employment letter, reference letter, identity document, and bank statement
3. WHEN a seeker uploads a document, THE Document_Uploader SHALL validate that the file is a PDF, JPG, or PNG and does not exceed 10 MB
4. IF a seeker uploads a file with an unsupported format or exceeding the size limit, THEN THE Document_Uploader SHALL reject the upload and display a specific validation error
5. WHEN a seeker uploads a document, THE Document_Uploader SHALL store the file in Supabase Storage and create a metadata record linking the file to the user
6. WHEN a seeker views their documents section, THE Document_Uploader SHALL display all uploaded documents with file name, document type, upload date, and a download link
7. WHEN a seeker deletes a document, THE Document_Uploader SHALL remove the file from storage and delete the metadata record
8. THE Document_Uploader SHALL allow a poster to request specific documents from a seeker through the messaging system
9. WHEN a seeker shares a document with a poster, THE Document_Uploader SHALL generate a time-limited access URL valid for 7 days

### Requirement 4: Listing Comparison Tool

**User Story:** As a seeker, I want to compare 2 to 3 listings side by side, so that I can evaluate price, area, features, and location differences to make an informed decision.

#### Acceptance Criteria

1. WHEN a seeker views search results or a listing detail page, THE Comparison_Tool SHALL provide an "Add to Compare" action for each listing
2. THE Comparison_Tool SHALL allow a seeker to select a minimum of 2 and a maximum of 3 listings for comparison
3. IF a seeker attempts to add more than 3 listings to the comparison, THEN THE Comparison_Tool SHALL display a message indicating the maximum has been reached
4. WHEN a seeker opens the comparison view, THE Comparison_Tool SHALL display the selected listings in a side-by-side layout showing: title, monthly rent, currency, property type, floor area, number of rooms, address, available date, and amenity tags
5. THE Comparison_Tool SHALL highlight differences between compared listings using visual indicators for fields where values differ
6. WHEN a seeker removes a listing from the comparison, THE Comparison_Tool SHALL update the comparison view to reflect the remaining listings
7. THE Comparison_Tool SHALL persist the comparison selection in the browser session so that navigating between pages does not clear the selection
8. WHEN a seeker views the comparison on a mobile device, THE Comparison_Tool SHALL present the data in a scrollable card layout instead of a table

### Requirement 5: SEO and Sitemap

**User Story:** As a platform operator, I want dynamic sitemaps, structured data, and social sharing tags, so that search engines index listings effectively and shared links display rich previews.

#### Acceptance Criteria

1. THE SEO_Engine SHALL generate a dynamic `sitemap.xml` at the root URL that includes all active listing URLs, static pages, and neighborhood guide pages
2. THE SEO_Engine SHALL update the sitemap when listings are created, activated, or archived
3. THE SEO_Engine SHALL serve a `robots.txt` file at the root URL that allows search engine crawling and references the sitemap URL
4. WHEN a listing detail page is rendered, THE SEO_Engine SHALL include JSON-LD structured data conforming to the Schema.org `RentalListing` type with price, location, description, and photos
5. WHEN a listing detail page is rendered, THE SEO_Engine SHALL include Open Graph meta tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) for social media sharing
6. WHEN a listing detail page is rendered, THE SEO_Engine SHALL include Twitter Card meta tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
7. THE SEO_Engine SHALL generate unique, descriptive `<title>` and `<meta name="description">` tags for each listing page using the listing title, city, and price
8. WHEN the sitemap contains more than 50,000 URLs, THE SEO_Engine SHALL split the sitemap into multiple files referenced by a sitemap index

### Requirement 6: Multi-language UI Integration

**User Story:** As an expat user, I want the entire UI to display in my preferred language, so that I can navigate and use the platform comfortably in my native language.

#### Acceptance Criteria

1. THE I18n_Layer SHALL replace all hardcoded English strings in UI components with translated strings from the next-intl message files
2. THE I18n_Layer SHALL support all 6 configured locales: English, Spanish, French, German, Portuguese, and Italian
3. WHEN a user changes their preferred language via the language selector, THE I18n_Layer SHALL re-render all visible UI text in the selected language without a full page reload
4. THE I18n_Layer SHALL use the `useTranslations()` hook in all client components and `getTranslations()` in all server components to retrieve translated strings
5. WHEN a translation key is missing for a locale, THE I18n_Layer SHALL fall back to the English translation
6. THE I18n_Layer SHALL translate all navigation labels, form labels, button text, error messages, empty states, and footer content
7. THE I18n_Layer SHALL format dates, numbers, and currencies according to the active locale conventions
8. WHEN new UI text is added to a component, THE I18n_Layer SHALL require a corresponding entry in all 6 message JSON files

### Requirement 7: Neighborhood Guides

**User Story:** As an expat seeker, I want to view neighborhood information including transit access, safety, and nearby amenities, so that I can evaluate the area before renting.

#### Acceptance Criteria

1. WHEN a user navigates to `/neighborhoods/[city]/[neighborhood]`, THE Neighborhood_Guide SHALL display a dedicated page for that neighborhood
2. THE Neighborhood_Guide SHALL display the following sections: overview description, transit score and nearby public transport, safety information, nearby amenities (supermarkets, pharmacies, schools, parks), and average rental price for the area
3. WHEN a listing detail page is rendered, THE App SHALL display a link to the corresponding neighborhood guide if the listing's address includes a neighborhood value
4. THE Neighborhood_Guide SHALL display a map centered on the neighborhood boundaries using the existing Leaflet map integration
5. THE Neighborhood_Guide SHALL list active listings within the neighborhood with links to their detail pages
6. WHEN an admin creates or edits neighborhood guide content, THE Blog_System SHALL provide a content management interface in the admin panel
7. IF a user navigates to a neighborhood guide that has no content, THEN THE Neighborhood_Guide SHALL display a placeholder page indicating that information is coming soon
8. THE SEO_Engine SHALL include neighborhood guide pages in the dynamic sitemap

### Requirement 8: Blog and News Section

**User Story:** As a platform operator, I want a blog section with moving guides, city guides, and rental tips, so that the platform attracts organic search traffic and provides value to expat users.

#### Acceptance Criteria

1. WHEN a user navigates to `/blog`, THE Blog_System SHALL display a paginated list of published articles sorted by publication date descending
2. WHEN a user selects an article, THE Blog_System SHALL display the full article content at `/blog/[slug]` with title, author, publication date, category, and body content
3. THE Blog_System SHALL support the following article categories: moving guides, city guides, rental tips, and expat life
4. WHEN an admin creates a new article through the admin panel, THE Blog_System SHALL store the article with title, slug, body content, category, author, publication date, featured image URL, and published status
5. WHEN an admin saves an article as draft, THE Blog_System SHALL store the article without making it visible to public users
6. WHEN a published article is rendered, THE SEO_Engine SHALL include JSON-LD structured data conforming to the Schema.org `Article` type
7. WHEN a published article is rendered, THE SEO_Engine SHALL include Open Graph and Twitter Card meta tags using the article title, excerpt, and featured image
8. THE Blog_System SHALL display a sidebar or section with related articles based on the same category
9. THE SEO_Engine SHALL include all published blog article URLs in the dynamic sitemap
10. WHEN a user views the blog listing page, THE Blog_System SHALL provide category filter tabs to filter articles by category
