export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="glass-card">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Privacy Policy</h1>
          <div className="space-y-6 text-sm text-[var(--text-secondary)]">
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">1. Data Collection</h2>
              <p>We collect personal data including your name, email address, and preferences when you register. Listing data, reviews, and payment information are collected during platform use.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">2. Processing Purposes</h2>
              <p>Your data is processed for: account management, listing services, payment processing, trust score calculation, scam prevention, and platform improvement analytics.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">3. Data Retention</h2>
              <p>Personal data is retained for the duration of your account. Transaction records are kept for 7 years for legal compliance. You may request deletion at any time.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">4. Your Rights</h2>
              <p>Under GDPR, you have the right to: access your data, request data export (JSON format), request data deletion, withdraw consent, and lodge a complaint with a supervisory authority.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">5. Data Storage</h2>
              <p>All personal data is stored in data centers located within the European Economic Area (EEA).</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">6. Cookies</h2>
              <p>We use essential cookies for platform functionality. Non-essential cookies (analytics, marketing, personalization) are only set with your explicit consent.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">7. Contact</h2>
              <p>For privacy inquiries, contact our Data Protection Officer at privacy@apartmentfinder.eu.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
