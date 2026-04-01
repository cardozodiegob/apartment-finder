"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon issue with webpack
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapListing {
  _id: string;
  title: string;
  monthlyRent: number;
  currency: string;
  location: { coordinates: [number, number] };
}

interface MapViewProps {
  listings: MapListing[];
  onBoundaryChange?: (boundary: number[][][] | null) => void;
}

function DrawingHandler({
  isDrawing,
  points,
  onAddPoint,
}: {
  isDrawing: boolean;
  points: [number, number][];
  onAddPoint: (latlng: [number, number]) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (isDrawing) {
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }
    return () => {
      map.getContainer().style.cursor = "";
    };
  }, [isDrawing, map]);

  useMapEvents({
    click(e) {
      if (isDrawing) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
  });

  return null;
}

export default function MapView({ listings, onBoundaryChange }: MapViewProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const drawPointsRef = useRef<[number, number][]>([]);

  const center: [number, number] = listings.length > 0
    ? [listings[0].location.coordinates[1], listings[0].location.coordinates[0]]
    : [48.8566, 2.3522]; // Default: Paris

  const handleAddPoint = useCallback((latlng: [number, number]) => {
    const newPoints = [...drawPointsRef.current, latlng];
    drawPointsRef.current = newPoints;
    setDrawPoints(newPoints);

    // Auto-notify parent when we have 3+ points
    if (newPoints.length >= 3 && onBoundaryChange) {
      const coords = newPoints.map(([lat, lng]) => [lng, lat]);
      // Close the polygon ring
      coords.push(coords[0]);
      onBoundaryChange([coords]);
    }
  }, [onBoundaryChange]);

  const handleToggleDraw = () => {
    if (isDrawing) {
      setIsDrawing(false);
    } else {
      setIsDrawing(true);
    }
  };

  const handleClear = () => {
    setIsDrawing(false);
    setDrawPoints([]);
    drawPointsRef.current = [];
    onBoundaryChange?.(null);
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <DrawingHandler isDrawing={isDrawing} points={drawPoints} onAddPoint={handleAddPoint} />
        {drawPoints.length >= 2 && (
          <Polygon
            positions={drawPoints}
            pathOptions={{ color: "#3b82f6", weight: 2, fillOpacity: 0.15 }}
          />
        )}
        {listings.map((listing) => (
          <Marker key={listing._id} position={[listing.location.coordinates[1], listing.location.coordinates[0]]}>
            <Popup>
              <strong>{listing.title}</strong><br />
              {listing.currency} {listing.monthlyRent}/mo
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Draw controls overlay */}
      {onBoundaryChange && (
        <div className="absolute top-3 right-3 z-[1000] flex gap-2">
          <button
            type="button"
            onClick={handleToggleDraw}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium shadow-md transition-colors ${
              isDrawing
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
            }`}
          >
            {isDrawing ? "Drawing…" : "Draw Area"}
          </button>
          {drawPoints.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg text-sm font-medium shadow-md bg-white text-red-600 hover:bg-red-50 border border-gray-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
