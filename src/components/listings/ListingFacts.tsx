"use client";

import type { Amenity } from "@/lib/constants/amenities";
import { AMENITY_LABEL_KEYS } from "@/lib/constants/amenities";
import type { EnergyRating } from "@/lib/db/models/Listing";
import EnergyRatingBadge from "./EnergyRatingBadge";

export interface ListingFactsData {
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  floorArea?: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  heatingType?: string;
  energyRating?: string;
  leaseType?: string;
  minStayMonths?: number;
  maxStayMonths?: number;
  amenities?: Amenity[];
  houseRules?: string[];
  utilitiesIncluded?: boolean;
  isFurnished?: boolean;
  isPetFriendly?: boolean;
  hasParking?: boolean;
  hasBalcony?: boolean;
}

const LEASE_LABELS: Record<string, string> = {
  fixed_term: "Fixed term",
  open_ended: "Open-ended",
  student_semester: "Student semester",
  short_term: "Short term",
};

const HEATING_LABELS: Record<string, string> = {
  central: "Central",
  gas: "Gas",
  electric: "Electric",
  district: "District",
  heatPump: "Heat pump",
  woodStove: "Wood stove",
  none: "None",
};

const HOUSE_RULE_LABELS: Record<string, string> = {
  noSmoking: "No smoking",
  noPets: "No pets",
  noParties: "No parties",
  quietHours: "Quiet hours",
  overnightGuestsAllowed: "Overnight guests allowed",
  coupleFriendly: "Couple friendly",
  studentsOnly: "Students only",
  workingProfessionalsOnly: "Working professionals only",
};

function formatAmenity(a: string): string {
  // Fallback formatter when translation isn't available
  const key = AMENITY_LABEL_KEYS[a as Amenity];
  if (!key) return a;
  return a
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-[var(--border)] last:border-0">
      <dt className="text-sm text-[var(--text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--text-primary)] text-right max-w-[60%]">{value}</dd>
    </div>
  );
}

export default function ListingFacts({ data }: { data: ListingFactsData }) {
  const rows: Array<[string, React.ReactNode]> = [];

  if (data.bedrooms !== undefined) rows.push(["Bedrooms", data.bedrooms]);
  if (data.bathrooms !== undefined) rows.push(["Bathrooms", data.bathrooms]);
  if (data.beds !== undefined) rows.push(["Beds", data.beds]);
  if (data.floorArea !== undefined && data.floorArea > 0) rows.push(["Floor area", `${data.floorArea} m²`]);
  if (data.floor !== undefined && data.totalFloors !== undefined && data.totalFloors > 0) {
    rows.push(["Floor", `${data.floor} / ${data.totalFloors}`]);
  } else if (data.floor !== undefined) {
    rows.push(["Floor", data.floor]);
  }
  if (data.yearBuilt !== undefined) rows.push(["Year built", data.yearBuilt]);
  if (data.heatingType) rows.push(["Heating", HEATING_LABELS[data.heatingType] ?? data.heatingType]);
  if (data.energyRating) {
    rows.push([
      "Energy rating",
      <EnergyRatingBadge key="er" rating={data.energyRating as EnergyRating} size="sm" />,
    ]);
  }
  if (data.leaseType) rows.push(["Lease type", LEASE_LABELS[data.leaseType] ?? data.leaseType]);
  if (data.minStayMonths !== undefined || data.maxStayMonths !== undefined) {
    const min = data.minStayMonths ?? 0;
    const max = data.maxStayMonths;
    rows.push([
      "Stay length",
      max ? `${min}–${max} months` : `${min}+ months`,
    ]);
  }
  if (data.utilitiesIncluded !== undefined) {
    rows.push(["Utilities included", data.utilitiesIncluded ? "Yes" : "No"]);
  }

  const hasAmenities = data.amenities && data.amenities.length > 0;
  const hasRules = data.houseRules && data.houseRules.length > 0;

  if (rows.length === 0 && !hasAmenities && !hasRules) return null;

  return (
    <div className="glass-card">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Facts</h2>

      {rows.length > 0 && (
        <dl className="mb-4">
          {rows.map(([label, value]) => (
            <Row key={label} label={label} value={value} />
          ))}
        </dl>
      )}

      {hasAmenities && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Amenities</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.amenities!.map((a) => (
              <span
                key={a}
                className="px-2 py-0.5 text-xs rounded-full bg-[var(--background-secondary)] text-[var(--text-primary)]"
              >
                {formatAmenity(a)}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasRules && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">House rules</h3>
          <ul className="space-y-1">
            {data.houseRules!.map((r) => (
              <li key={r} className="text-sm text-[var(--text-secondary)]">
                • {HOUSE_RULE_LABELS[r] ?? r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
