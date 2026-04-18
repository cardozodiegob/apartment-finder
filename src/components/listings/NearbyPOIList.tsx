"use client";

interface NearbyPOI {
  kind: string;
  name: string;
  distanceMeters: number;
}

interface NearbyPOIListProps {
  title: string;
  items: NearbyPOI[];
}

const KIND_LABELS: Record<string, string> = {
  bus_stop: "Bus stop",
  train_station: "Train",
  subway: "Subway",
  supermarket: "Supermarket",
  pharmacy: "Pharmacy",
  school: "School",
  hospital: "Hospital",
  park: "Park",
  restaurant: "Restaurant",
};

export default function NearbyPOIList({ title, items }: NearbyPOIListProps) {
  if (!items || items.length === 0) return null;
  return (
    <div className="glass-card">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <ul className="space-y-1">
        {items.slice(0, 8).map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex items-baseline justify-between text-sm">
            <span className="text-[var(--text-primary)] truncate max-w-[70%]">
              {p.name}
              <span className="text-xs text-[var(--text-muted)] ml-2">
                ({KIND_LABELS[p.kind] ?? p.kind})
              </span>
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {p.distanceMeters < 1000
                ? `${p.distanceMeters} m`
                : `${(p.distanceMeters / 1000).toFixed(1)} km`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
