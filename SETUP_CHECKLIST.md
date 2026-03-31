let's# Apartment Finder — Setup Checklist

Work through these one at a time. After each step, tell me "done" and I'll verify.

---

## Supabase (partially done)

- [x] 1. Create Supabase project
- [x] 2. Copy project URL and API keys to `.env.local`
- [x] 3. Create `listing-photos` storage bucket
- [x] 4. Make `listing-photos` bucket public (Settings > Policies > allow public SELECT)
- [x] 5. Enable Email auth provider (Authentication > Providers > Email)
- [x] 6. Enable Google OAuth provider (Authentication > Providers > Google)
- [x] 7. Enable GitHub OAuth provider (Authentication > Providers > GitHub)
- [x] 8. Set redirect URLs in Supabase Auth settings

---

## MongoDB Atlas

- [x] 9. Create a MongoDB Atlas account (mongodb.com/atlas)
- [x] 10. Create a free cluster in an EU region (e.g., Frankfurt, Ireland)
- [x] 11. Create a database user with read/write access
- [x] 12. Whitelist your IP (or 0.0.0.0/0 for dev)
- [x] 13. Copy the connection string to `.env.local` MONGODB_URI

---

## Stripe

- [ ] 14. Create a Stripe account (stripe.com)
- [ ] 15. Copy publishable key to `.env.local` NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- [ ] 16. Copy secret key to `.env.local` STRIPE_SECRET_KEY
- [ ] 17. (Later, for production) Set up Stripe Connect for escrow payments
- [ ] 18. (Later, for production) Create webhook endpoint for payment events

---

## Resend (transactional email)

- [x] 19. Create a Resend account (resend.com)
- [x] 20. Get API key and paste into `.env.local` RESEND_API_KEY
- [ ] 21. (Later) Verify your sending domain for production

---

## Exchange Rate API

- [x] 22. Sign up at exchangerate-api.com (free tier works)
- [x] 23. Copy API key to `.env.local` EXCHANGE_RATE_API_KEY

---

## Initial Admin

- [x] 24. Set INITIAL_ADMIN_EMAIL in `.env.local`
- [x] 25. Set INITIAL_ADMIN_PASSWORD in `.env.local`

---

## GitHub Integration

- [x] 26. Connect GitHub repo to Supabase (already shown in screenshot)
- [ ] 27. Click "Enable integration" in Supabase GitHub settings

---

## Final Verification

- [ ] 28. Run `npm run dev` and verify the app starts
- [ ] 29. Test registration flow
- [ ] 30. Test login flow
- [ ] 31. Verify admin panel accessible at /admin

---

**Security reminder**: Never commit `.env.local` to git. It's already in `.gitignore`.
