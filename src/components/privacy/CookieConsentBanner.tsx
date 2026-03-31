"use client";

import { useState, useEffect } from "react";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [personalization, setPersonalization] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) setVisible(true);
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({ essential: true, analytics: true, marketing: true, personalization: true }));
    setVisible(false);
  };

  const handleRejectAll = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({ essential: true, analytics: false, marketing: false, personalization: false }));
    setVisible(false);
  };

  const handleSaveCustom = () => {
    localStorage.setItem("cookieConsent", JSON.stringify({ essential: true, analytics, marketing, personalization }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-2xl mx-auto glass-card">
        <h3 className="font-semibold text-[var(--text-primary)] mb-2">Cookie Preferences</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          We use cookies to enhance your experience. Essential cookies are always active. You can customize your preferences below.
        </p>
        {showCustomize && (
          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked disabled /> Essential (always on)
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> Analytics
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> Marketing
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={personalization} onChange={(e) => setPersonalization(e.target.checked)} /> Personalization
            </label>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleAcceptAll} className="px-4 py-2 bg-navy-500 text-white rounded-lg text-sm font-medium hover:bg-navy-600">Accept All</button>
          <button onClick={handleRejectAll} className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm">Reject All</button>
          {showCustomize ? (
            <button onClick={handleSaveCustom} className="px-4 py-2 border border-navy-500 text-navy-500 rounded-lg text-sm">Save Preferences</button>
          ) : (
            <button onClick={() => setShowCustomize(true)} className="px-4 py-2 border border-[var(--border)] text-[var(--text-secondary)] rounded-lg text-sm">Customize</button>
          )}
        </div>
      </div>
    </div>
  );
}
