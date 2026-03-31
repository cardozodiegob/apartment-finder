# Requirements Document

## Introduction

Apartment Finder is a modern web application designed to help expats in Europe find apartments, rooms, and houses for rent. The platform enables admins and posting users to create rental publications while providing a safe, scam-resistant experience for seekers. Built with Next.js, Tailwind CSS, MongoDB, Supabase, React Context, and Redux, the application features an Apple-style modern UI with internationalization support, advanced filtering, a trust-based recommendation system, GDPR compliance, and secure payment verification.

## Glossary

- **Platform**: The Apartment Finder web application as a whole
- **Seeker**: A registered user who searches for apartments, rooms, or houses to rent
- **Poster**: A registered user who creates and manages rental listings
- **Admin**: A privileged user who manages the platform, reviews reports, and moderates content
- **Listing**: A publication for an apartment, room, or house available for rent
- **Filter_System**: The component responsible for filtering and searching listings
- **Map_Filter**: The component that allows users to draw geographic boundaries on a map
- **Auth_System**: The component responsible for user registration, login, and session management
- **Recommendation_Engine**: The component that calculates trust scores based on community feedback
- **Trust_Score**: A numeric reputation value assigned to each user
- **Payment_System**: The component that handles rent payment processing with dual-party verification
- **Report_System**: The component for reporting incompliances and scam attempts
- **Scam_Detection_Module**: The component that monitors for fraudulent patterns
- **Internationalization_Module**: The component for language detection, translation, and locale formatting
- **Currency_Converter**: The component that converts rental prices to the user preferred currency
- **Privacy_Module**: The component that manages GDPR compliance and data subject rights
- **Admin_Panel**: The administrative dashboard for platform management
- **UI_Shell**: The main application layout including navigation, hero sections, and visual theme
- **Notification_System**: The component that delivers alerts and updates to users


## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As an expat looking for housing in Europe, I want to register and log in securely, so that I can access the platform and manage my profile.

#### Acceptance Criteria

1. THE Auth_System SHALL provide registration forms that collect email, password, full name, and preferred language.
2. WHEN a user submits a registration form with valid data, THE Auth_System SHALL create a new user account in Supabase and send an email verification link.
3. WHEN a user submits a registration form with an already-registered email, THE Auth_System SHALL display an error message indicating the email is already in use.
4. WHEN a user clicks the email verification link, THE Auth_System SHALL mark the user account as verified and redirect to the login page.
5. WHEN a user submits valid login credentials, THE Auth_System SHALL authenticate the user and establish a session.
6. IF a user submits invalid login credentials three consecutive times, THEN THE Auth_System SHALL temporarily lock the account for 15 minutes and notify the user via email.
7. THE Auth_System SHALL support OAuth login via Google and GitHub as alternative registration methods.
8. WHEN a user requests a password reset, THE Auth_System SHALL send a password reset link to the registered email address.


### Requirement 2: Listing Creation and Management

**User Story:** As a poster, I want to create and manage rental listings, so that seekers can find my available apartments, rooms, or houses.

#### Acceptance Criteria

1. WHEN a verified Poster submits a new listing form, THE Platform SHALL create a Listing with title, description, property type, address, monthly rent, currency, available date, photos, and tags.
2. THE Platform SHALL support three property types for listings: apartment, room, and house.
3. WHEN a Poster uploads photos for a Listing, THE Platform SHALL validate that each photo is under 5MB and in JPEG, PNG, or WebP format.
4. WHEN a Poster marks a Listing as "shared accommodation," THE Platform SHALL display the Listing in shared-apartment search results.
5. WHILE a Listing is in "draft" status, THE Platform SHALL restrict visibility of the Listing to the owning Poster only.
6. WHEN a Poster publishes a Listing, THE Platform SHALL change the Listing status from "draft" to "active" and make the Listing visible to all users.
7. WHEN a Poster edits an active Listing, THE Platform SHALL save the changes and display the updated Listing within 5 seconds.
8. WHEN a Poster deletes a Listing, THE Platform SHALL remove the Listing from search results and mark the Listing as archived in the database.


### Requirement 3: Advanced Filter and Search System

**User Story:** As a seeker, I want to filter and search listings using multiple criteria, so that I can quickly find housing that matches my needs.

#### Acceptance Criteria

1. THE Filter_System SHALL allow filtering by property type, price range, number of bedrooms, available date, tags, and purpose (rent, share, or sublet).
2. WHEN a Seeker applies one or more filters, THE Filter_System SHALL return matching listings within 2 seconds.
3. WHEN a Seeker enters a text query, THE Filter_System SHALL perform a full-text search across listing titles, descriptions, and tags.
4. THE Filter_System SHALL allow combining multiple filters simultaneously using AND logic.
5. WHEN a Seeker draws a geographic boundary on the Map_Filter, THE Filter_System SHALL return only listings located within the drawn boundary.
6. WHEN a Seeker selects a predefined city or neighborhood from the location dropdown, THE Filter_System SHALL filter listings to that geographic area.
7. THE Filter_System SHALL display the total count of matching listings after each filter change.
8. WHEN a Seeker clears all filters, THE Filter_System SHALL reset the results to display all active listings.
9. THE Filter_System SHALL persist the selected filters in the URL query parameters so that filtered views are shareable via link.


### Requirement 4: Internationalization and Currency Conversion

**User Story:** As an expat from any country, I want the platform to display content in my language and prices in my preferred currency, so that I can use the platform comfortably.

#### Acceptance Criteria

1. WHEN a user first visits the Platform, THE Internationalization_Module SHALL detect the user browser language and set the interface language accordingly.
2. THE Internationalization_Module SHALL support a minimum of English, Spanish, French, German, Portuguese, and Italian as interface languages.
3. WHEN a user selects a different language from the language selector, THE Internationalization_Module SHALL update all interface text to the selected language without a page reload.
4. THE Currency_Converter SHALL display listing prices in the original currency alongside the user preferred currency.
5. WHEN a user selects a preferred currency, THE Currency_Converter SHALL convert all displayed listing prices using exchange rates updated within the last 24 hours.
6. THE Currency_Converter SHALL support a minimum of EUR, USD, GBP, CHF, SEK, NOK, DKK, PLN, CZK, and BRL as display currencies.
7. THE Platform SHALL format dates, numbers, and currency symbols according to the user selected locale.


### Requirement 5: Trust and Recommendation System

**User Story:** As a seeker, I want to see trust scores and reviews for posters, so that I can make informed decisions about who to rent from.

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL calculate a Trust_Score for each user based on verified transactions, community reviews, and profile completeness.
2. WHEN a rental transaction is completed and confirmed by both parties, THE Recommendation_Engine SHALL prompt both the Seeker and the Poster to submit a review.
3. WHEN a user submits a review, THE Recommendation_Engine SHALL update the reviewed user Trust_Score within 60 seconds.
4. THE Recommendation_Engine SHALL display the Trust_Score on the user profile and on each Listing created by that user.
5. WHEN a user has fewer than three completed transactions, THE Recommendation_Engine SHALL display a "New User" badge instead of a numeric Trust_Score.
6. IF a user Trust_Score drops below a defined threshold, THEN THE Recommendation_Engine SHALL flag the user account for Admin review and add a warning label to the user Listings.
7. THE Recommendation_Engine SHALL weight recent reviews more heavily than older reviews when calculating the Trust_Score.
8. WHEN a Seeker views a Listing, THE Recommendation_Engine SHALL display the three most recent reviews for the Poster alongside the Listing details.


### Requirement 6: Scam Detection and Prevention

**User Story:** As a seeker, I want the platform to detect and prevent scams, so that my rental process is safe and stress-free.

#### Acceptance Criteria

1. WHEN a Poster creates a new Listing, THE Scam_Detection_Module SHALL analyze the Listing content for known scam patterns including duplicated photos, unrealistic pricing, and suspicious descriptions.
2. IF the Scam_Detection_Module detects a high-risk Listing, THEN THE Scam_Detection_Module SHALL hold the Listing for Admin review before publishing.
3. WHEN a user reports a Listing or another user, THE Report_System SHALL create a report ticket and notify the Admin team within 5 minutes.
4. THE Report_System SHALL provide predefined report categories including "suspected scam," "misleading information," "harassment," and "other."
5. WHILE a Listing is under investigation due to a report, THE Platform SHALL display an "under review" label on the Listing.
6. WHEN an Admin resolves a report, THE Report_System SHALL notify the reporting user and the reported user of the resolution outcome.
7. IF a Poster receives three or more confirmed scam reports, THEN THE Platform SHALL suspend the Poster account and remove all active Listings from the Poster.
8. THE Scam_Detection_Module SHALL verify that uploaded listing photos are not duplicated from other active Listings on the Platform.


### Requirement 7: Payment System with Dual-Party Verification

**User Story:** As a seeker, I want to make secure payments that require confirmation from both parties, so that I am protected from unauthorized charges.

#### Acceptance Criteria

1. WHEN a Seeker initiates a rent payment, THE Payment_System SHALL create a pending payment record and notify the Poster.
2. WHEN both the Seeker and the Poster confirm a payment, THE Payment_System SHALL process the payment and transfer funds.
3. IF only one party confirms a payment within 72 hours, THEN THE Payment_System SHALL cancel the payment and notify both parties.
4. THE Payment_System SHALL hold funds in escrow until both parties confirm the transaction.
5. WHEN a payment is completed, THE Payment_System SHALL generate a receipt for both the Seeker and the Poster.
6. IF a payment dispute is raised by either party, THEN THE Payment_System SHALL freeze the escrowed funds and create a dispute ticket for Admin review.
7. THE Payment_System SHALL support payments in EUR, GBP, CHF, and USD as processing currencies.
8. WHEN a Seeker views a payment summary, THE Payment_System SHALL display the amount in both the processing currency and the Seeker preferred currency.


### Requirement 8: Admin Panel and Platform Management

**User Story:** As an admin, I want a comprehensive dashboard to manage users, listings, and reports, so that I can maintain platform quality and safety.

#### Acceptance Criteria

1. WHEN the Platform is deployed for the first time, THE Admin_Panel SHALL create an initial admin user account using credentials defined in environment variables.
2. WHEN an Admin logs in, THE Admin_Panel SHALL display a dashboard with summary metrics including total users, active listings, pending reports, and recent transactions.
3. THE Admin_Panel SHALL provide a user management view where Admins can search, view, suspend, and reactivate user accounts.
4. THE Admin_Panel SHALL provide a listing management view where Admins can search, review, approve, and remove Listings.
5. WHEN an Admin reviews a reported Listing or user, THE Admin_Panel SHALL display the full report history, user Trust_Score, and transaction history for that entity.
6. THE Admin_Panel SHALL provide a report queue sorted by priority with the oldest unresolved reports displayed first.
7. WHEN an Admin takes a moderation action, THE Admin_Panel SHALL log the action with the Admin identifier, timestamp, and reason.
8. THE Admin_Panel SHALL restrict access to users with the "admin" role only.


### Requirement 9: GDPR Compliance and Privacy

**User Story:** As a user in the EU, I want the platform to comply with GDPR regulations, so that my personal data is handled lawfully and transparently.

#### Acceptance Criteria

1. WHEN a user first visits the Platform, THE Privacy_Module SHALL display a cookie consent banner that allows the user to accept, reject, or customize cookie preferences.
2. THE Privacy_Module SHALL not set any non-essential cookies until the user provides explicit consent.
3. THE Platform SHALL provide a publicly accessible privacy policy page that describes data collection, processing purposes, data retention periods, and user rights.
4. WHEN a user requests access to personal data, THE Privacy_Module SHALL generate a downloadable data export in JSON format within 30 days.
5. WHEN a user requests deletion of personal data, THE Privacy_Module SHALL delete all personal data associated with the user account within 30 days and confirm the deletion via email.
6. THE Privacy_Module SHALL record a timestamped consent log for each user that tracks consent given and withdrawn for each processing purpose.
7. WHEN a user withdraws consent for a specific processing purpose, THE Privacy_Module SHALL stop processing the user data for that purpose within 24 hours.
8. THE Platform SHALL store all user personal data in data centers located within the European Economic Area.


### Requirement 10: UI/UX and Visual Design

**User Story:** As a user, I want a modern, elegant, and accessible interface, so that I can navigate the platform intuitively regardless of my device or ability.

#### Acceptance Criteria

1. THE UI_Shell SHALL implement a dark mode theme with white and dark blue as primary colors, using glassmorphism effects with background transparency.
2. THE UI_Shell SHALL implement parallax scrolling effects on the homepage hero section and listing detail pages.
3. THE UI_Shell SHALL be fully responsive and render correctly on viewports from 320px to 2560px wide.
4. THE UI_Shell SHALL display placeholder images in hero sections and listing cards when no user-uploaded images are available.
5. WHEN a user toggles between light mode and dark mode, THE UI_Shell SHALL apply the selected theme across all pages without a page reload.
6. THE UI_Shell SHALL meet WCAG 2.1 Level AA contrast requirements for all text elements in both light and dark modes.
7. THE Platform SHALL render the initial page content within 2 seconds on a standard broadband connection using Next.js server-side rendering.
8. THE UI_Shell SHALL use Tailwind CSS utility classes for all styling to ensure design consistency and maintainability.


### Requirement 11: Shared Accommodation Search

**User Story:** As a seeker, I want to search for apartments where the poster is looking for roommates, so that I can find shared living arrangements.

#### Acceptance Criteria

1. WHEN a Poster creates a Listing, THE Platform SHALL allow the Poster to mark the Listing as "looking for roommates."
2. THE Filter_System SHALL provide a dedicated "shared accommodation" filter that returns only Listings marked as "looking for roommates."
3. WHEN a Seeker views a shared accommodation Listing, THE Platform SHALL display the number of current occupants and available rooms.
4. THE Platform SHALL allow Seekers to send a roommate interest request to the Poster of a shared accommodation Listing.
5. WHEN a Poster receives a roommate interest request, THE Platform SHALL notify the Poster via email and in-app notification.


### Requirement 12: Notification System

**User Story:** As a user, I want to receive timely notifications about relevant activity, so that I stay informed about my listings, payments, and messages.

#### Acceptance Criteria

1. THE Notification_System SHALL deliver in-app notifications for new messages, payment updates, report resolutions, and listing status changes.
2. WHEN a notification-triggering event occurs, THE Notification_System SHALL deliver the in-app notification within 30 seconds.
3. THE Notification_System SHALL send email notifications for payment confirmations, account security events, and report outcomes.
4. WHEN a user updates notification preferences, THE Notification_System SHALL apply the updated preferences to all future notifications immediately.
5. THE Notification_System SHALL provide a notification center view where users can view, mark as read, and dismiss past notifications.


### Requirement 13: State Management

**User Story:** As a developer, I want a well-structured state management architecture, so that the application data flow is predictable and maintainable.

#### Acceptance Criteria

1. THE Platform SHALL use React Context for local UI state including theme selection, language preference, and notification panel visibility.
2. THE Platform SHALL use Redux for global application state including user session, listing cache, filter selections, and payment status.
3. THE Platform SHALL persist Redux state for user session and filter selections across page navigations using server-side compatible storage.
4. WHEN a state mutation occurs in Redux, THE Platform SHALL update all dependent UI components within a single render cycle.
