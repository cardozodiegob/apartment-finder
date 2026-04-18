/**
 * UserAvatar — deterministic SVG avatar rendering an initial.
 *
 * Removes the dependency on placehold.co (broken in offline / strict-CSP
 * environments, and a minor privacy leak). Color is derived deterministically
 * from the name so the same user always gets the same tile.
 */

interface UserAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

const PALETTE = [
  "#4f46e5", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#2563eb",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default function UserAvatar({
  name,
  photoUrl,
  size = 96,
  className = "",
}: UserAvatarProps) {
  const initial = (name || "?").charAt(0).toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${name}'s avatar`}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const color = PALETTE[hashName(name) % PALETTE.length];
  const fontSize = Math.round(size * 0.45);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${name}'s avatar`}
      className={`rounded-full ${className}`}
    >
      <rect width={size} height={size} rx={size / 2} fill={color} />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={fontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="600"
      >
        {initial}
      </text>
    </svg>
  );
}
