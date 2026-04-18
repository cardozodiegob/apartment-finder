import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Move-in Guarantee — ApartmentFinder",
  description:
    "We hold your first month's rent in escrow until you confirm you've moved in. You have 48 hours to dispute if the place isn't what was promised.",
};

export default function MoveInGuaranteePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-navy-100 dark:bg-navy-900/40 mb-4">
            <svg className="w-8 h-8 text-navy-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-3">
            Move-in Guarantee
          </h1>
          <p className="text-lg text-[var(--text-secondary)]">
            Your deposit stays safe until you&apos;re in the door.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { t: "1. Pay into escrow", d: "Your first month and deposit sit in a protected account. No one can touch them until you confirm." },
            { t: "2. Move in", d: "The poster can&apos;t collect the money until after your move-in date." },
            { t: "3. 48-hour window", d: "Dispute within 48 hours if the place isn&apos;t as advertised — we freeze the funds while we investigate." },
          ].map((step) => (
            <div key={step.t} className="glass-card">
              <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">{step.t}</h3>
              <p className="text-sm text-[var(--text-secondary)]" dangerouslySetInnerHTML={{ __html: step.d }} />
            </div>
          ))}
        </div>

        <div className="glass-card mb-10">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">What we cover</h2>
          <ul className="list-disc pl-5 text-sm text-[var(--text-secondary)] space-y-1">
            <li>Fake listings — we refund the full amount</li>
            <li>Material misrepresentation (wrong size, missing amenities, unsafe conditions)</li>
            <li>Poster disappears or refuses access after payment</li>
            <li>Booking conflicts (already rented to someone else)</li>
          </ul>
        </div>

        <div className="text-center">
          <Link
            href="/search"
            className="inline-block px-6 py-3 bg-navy-500 text-white rounded-xl text-sm font-medium hover:bg-navy-600"
          >
            Find a protected listing
          </Link>
        </div>
      </div>
    </div>
  );
}
