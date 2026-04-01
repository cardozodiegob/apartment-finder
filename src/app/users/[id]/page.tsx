"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ReviewData {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ListingData {
  id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  city: string;
  propertyType: string;
  photos: string[];
}

interface ProfileData {
  id: string;
  fullName: string;
  bio: string | null;
  trustScore: number;
  badge: "new" | "trusted" | "verified";
  completedTransactions: number;
  recentReviews: ReviewData[];
  activeListings: ListingData[];
  memberSince: string;
  profileCompleteness: number;
  isSuspended: boolean;
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch(`/api/users/${userId}/profile`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.message || "Failed to load profile");
          return;
        }
        const data = await res.json();
        setProfile(data.profile);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <p className="text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <p className="text-red-500">{error || "Profile not found"}</p>
      </div>
    );
  }

  const badgeColors = {
    new: "bg-gray-100 text-gray-700",
    trusted: "bg-blue-100 text-blue-700",
    verified: "bg-green-100 text-green-700",
  };

  const trustPercentage = (profile.trustScore / 5) * 100;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {profile.isSuspended && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-medium">Account Flagged</p>
          <p className="text-red-600 text-sm">
            This account has been flagged for review by our moderation team.
          </p>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex items-start gap-6 mb-8">
        <img
          src={`https://placehold.co/120x120?text=${encodeURIComponent(profile.fullName.charAt(0))}`}
          alt={`${profile.fullName} avatar`}
          className="w-24 h-24 rounded-full object-cover"
        />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{profile.fullName}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[profile.badge]}`}>
              {profile.badge}
            </span>
          </div>
          {profile.bio && (
            <p className="text-gray-600 mb-2">{profile.bio}</p>
          )}
          <p className="text-sm text-gray-500">
            Member since {new Date(profile.memberSince).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{profile.trustScore.toFixed(1)}</div>
          <div className="text-sm text-gray-500">Trust Score</div>
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: `${trustPercentage}%` }}
            />
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{profile.completedTransactions}</div>
          <div className="text-sm text-gray-500">Transactions</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{profile.activeListings.length}</div>
          <div className="text-sm text-gray-500">Active Listings</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{Math.round(profile.profileCompleteness * 100)}%</div>
          <div className="text-sm text-gray-500">Profile Complete</div>
        </div>
      </div>

      {/* Recent Reviews */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Recent Reviews</h2>
        {profile.recentReviews.length === 0 ? (
          <p className="text-gray-500 text-sm">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {profile.recentReviews.map((review) => (
              <div key={review.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{review.reviewerName}</span>
                  <span className="text-yellow-500 text-sm">
                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{review.comment}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Listings */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Active Listings</h2>
        {profile.activeListings.length === 0 ? (
          <p className="text-gray-500 text-sm">No active listings.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.activeListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                <img
                  src={
                    listing.photos[0] ||
                    `https://placehold.co/400x200?text=${encodeURIComponent(listing.propertyType)}`
                  }
                  alt={listing.title}
                  className="w-full h-40 object-cover"
                />
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate">{listing.title}</h3>
                  <p className="text-gray-500 text-xs">{listing.city} · {listing.propertyType}</p>
                  <p className="font-semibold text-sm mt-1">
                    {listing.currency} {listing.monthlyRent.toLocaleString()}/mo
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
